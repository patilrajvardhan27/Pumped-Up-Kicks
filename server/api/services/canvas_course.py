"""
The bookkeeping half of a Canvas sync: progress reporting, the summary, and
adding, updating and removing one course's documents. Reading Canvas itself is
in canvas_readers.py.
"""
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from api.models.database import (
    CanvasConnection,
    Document,
    User,
    Workspace,
)
from api.services.canvas_client import CanvasClient, CanvasError, CanvasForbidden, CanvasNotFound
from api.services.document_text import Page, UnreadableDocument
from api.services.indexer import build_text_chunks, index_document
from api.services.quota import get_content_status

STEPS = ("modules", "syllabus", "pages", "files", "announcements", "assignments")
MAX_SKIPPED_NOTES = 50


def parse_time(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def text_hash(pages: List[Page]) -> str:
    return hashlib.sha256("\f".join(p.text for p in pages).encode("utf-8")).hexdigest()


def is_quiz(assignment: dict) -> bool:
    return bool(
        assignment.get("is_quiz_assignment")
        or assignment.get("quiz_id")
        or assignment.get("is_quiz_lti_assignment")
        or "online_quiz" in (assignment.get("submission_types") or [])
    )


@dataclass
class Summary:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    removed: int = 0
    deadlines: int = 0
    skipped: List[str] = field(default_factory=list)

    def skip(self, course: str, item: str, reason: str) -> None:
        if len(self.skipped) < MAX_SKIPPED_NOTES:
            self.skipped.append(f"{course}: {item}: {reason}")

    def to_json(self) -> str:
        return json.dumps(self.__dict__)


class Run:
    """One sync of one connection: its session, budget, progress and tally."""

    def __init__(self, db: Session, connection: CanvasConnection, client: CanvasClient, user: User):
        self.db = db
        self.connection = connection
        self.client = client
        self.user_id = user.id
        self.summary = Summary()
        content = get_content_status(db, user)
        self.used = content.used_chunks
        self.limit = content.limit_chunks

    def report(self, progress: int, detail: str) -> None:
        self.connection.sync_progress = max(0, min(99, progress))
        self.connection.sync_detail = detail[:200]
        self.db.commit()


class CourseStore:
    """One course's bookkeeping: progress, links, module labels, and documents added, kept or removed."""

    def __init__(self, run: Run, workspace: Workspace, index: int, total: int):
        self.run = run
        self.db = run.db
        self.client = run.client
        self.workspace = workspace
        self.course_id = workspace.canvas_course_id
        self.name = workspace.name
        self.index = index
        self.total = total
        self.modules: Dict[Tuple[str, object], Tuple[str, int]] = {}
        self.seen: Dict[str, Set[int]] = {}

    # -- helpers ------------------------------------------------------------

    def step(self, number: int, label: str) -> None:
        done = self.index * len(STEPS) + number
        self.run.report(5 + int(90 * done / (self.total * len(STEPS))), f"{self.name}: {label}")

    def link(self, path: str) -> str:
        return f"{self.client.base_url}/courses/{self.course_id}/{path}"

    def module_of(self, kind: str, key) -> Tuple[Optional[str], Optional[int]]:
        return self.modules.get((kind, key), (None, None))

    def existing(self, source: str, canvas_id: int) -> Optional[Document]:
        return (
            self.db.query(Document)
            .filter(
                Document.user_id == self.run.user_id,
                Document.source == source,
                Document.canvas_course_id == self.course_id,
                Document.canvas_id == canvas_id,
            )
            .first()
        )

    def upsert(
        self,
        source: str,
        canvas_id: int,
        title: str,
        read_pages: Callable[[], List[Page]],
        *,
        updated_at: Optional[datetime] = None,
        mime_type: Optional[str] = None,
        url: Optional[str] = None,
        module: Tuple[Optional[str], Optional[int]] = (None, None),
    ) -> None:
        """Bring one item up to date, downloading and embedding only if it changed."""
        self.seen.setdefault(source, set()).add(canvas_id)
        doc = self.existing(source, canvas_id)

        def describe(target: Document) -> None:
            # Cheap fields follow Canvas every time, without re-embedding.
            target.workspace_id = self.workspace.id
            target.title = title[:500]
            target.url = url
            target.mime_type = mime_type
            target.module_name, target.module_position = module
            target.synced_at = datetime.now(timezone.utc)

        if doc and updated_at and doc.updated_at == updated_at and doc.num_chunks > 0:
            describe(doc)
            self.db.commit()
            self.run.summary.unchanged += 1
            return

        try:
            pages = read_pages()
        except (UnreadableDocument, CanvasError) as e:
            self.run.summary.skip(self.name, title, str(e))
            return

        if not pages:
            if doc:
                self.db.delete(doc)
                self.db.commit()
                self.run.summary.removed += 1
            self.run.summary.skip(self.name, title, "no text to import (a scanned PDF, perhaps)")
            return

        digest = text_hash(pages)
        if doc and doc.content_hash == digest and doc.num_chunks > 0:
            describe(doc)
            doc.updated_at = updated_at
            self.db.commit()
            self.run.summary.unchanged += 1
            return

        previous = doc.num_chunks if doc else 0
        needed = len(build_text_chunks(pages))
        if self.run.used - previous + needed > self.run.limit:
            self.run.summary.skip(self.name, title, "over your plan's limit for imported material")
            return

        is_new = doc is None
        if is_new:
            doc = Document(
                user_id=self.run.user_id, source=source,
                canvas_course_id=self.course_id, canvas_id=canvas_id, num_chunks=0,
            )
            self.db.add(doc)
        describe(doc)
        doc.updated_at = updated_at
        doc.content_hash = digest
        doc.num_pages = sum(1 for p in pages if p.number is not None) or None
        self.db.flush()

        written = index_document(self.db, doc, pages)
        self.run.used += written - previous
        if is_new:
            self.run.summary.added += 1
        else:
            self.run.summary.updated += 1

    def remove_missing(self, source: str) -> None:
        stale = (
            self.db.query(Document)
            .filter(
                Document.user_id == self.run.user_id,
                Document.source == source,
                Document.canvas_course_id == self.course_id,
            )
            .all()
        )
        for doc in stale:
            if doc.canvas_id not in self.seen.get(source, set()):
                self.run.used -= doc.num_chunks
                self.db.delete(doc)
                self.run.summary.removed += 1
        self.db.commit()

    def listed(self, source: str, label: str, fetch: Callable[[], None]) -> None:
        """Run one list; on success, drop what is no longer there. A hidden list is noted, not fatal."""
        self.seen.setdefault(source, set())
        try:
            fetch()
        except CanvasForbidden:
            self.run.summary.skip(self.name, label, "not available to you in this course")
            return
        except CanvasNotFound:
            self.run.summary.skip(self.name, label, "not found in this course")
            return
        self.remove_missing(source)

    # -- the steps ----------------------------------------------------------
