"""
Imports course material from Canvas into the student's subjects.

Runs in the background after the request that starts it, on its own session,
like the lecture pipeline, and reports progress on the connection row so the
client can poll it.

For each course linked to a subject it reads the module structure (to label
material with its module), the syllabus, pages, files (PDF, PPTX, DOCX),
announcements and assignments. It never asks Canvas for quizzes, submissions,
grades or anyone else's data, and a quiz-type assignment keeps only its title
and due date.

A later sync only downloads and embeds what changed. An item whose Canvas
timestamp is the same as last time is left alone; where Canvas gives no
timestamp (the syllabus, announcements) the text is compared instead. Items
that disappeared from Canvas, or that the student can no longer open, are
removed, but only from lists Canvas actually returned this time: if Files is
hidden in a course today, what was imported from it earlier stays.
"""
import hashlib
import json
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import quote

from sqlalchemy.orm import Session

from api.config import settings
from api.models.database import (
    CanvasConnection,
    Deadline,
    Document,
    User,
    Workspace,
    get_session,
)
from api.services import document_text
from api.services.canvas_auth import CanvasAuthError, access_token_for
from api.services.canvas_client import CanvasClient, CanvasError, CanvasForbidden, CanvasNotFound
from api.services.document_text import Page, UnreadableDocument
from api.services.indexer import build_text_chunks, index_document
from api.services.quota import get_content_status

# Swapped in tests for a client on recorded responses.
client_factory: Callable[[str, str], CanvasClient] = CanvasClient

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


class CourseSync:
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

    def read_modules(self) -> None:
        try:
            modules = list(self.client.paginate(
                f"/api/v1/courses/{self.course_id}/modules", {"include[]": "items", "per_page": 100}
            ))
        except (CanvasForbidden, CanvasNotFound):
            self.run.summary.skip(self.name, "Modules", "not available to you in this course")
            return
        for module in modules:
            items = module.get("items")
            if items is None and module.get("items_url"):
                items = list(self.client.paginate(module["items_url"], {"per_page": 100}))
            label = (module.get("name") or "Module", module.get("position") or 0)
            for item in items or []:
                kind = item.get("type")
                key = item.get("page_url") if kind == "Page" else item.get("content_id")
                if kind and key is not None:
                    self.modules[(kind, key)] = label

    def read_syllabus(self) -> None:
        course = self.client.get_json(
            f"/api/v1/courses/{self.course_id}", {"include[]": "syllabus_body"}
        )
        body = document_text.html_to_text(course.get("syllabus_body"))
        if body:
            self.upsert(
                "canvas_syllabus", self.course_id, f"{course.get('name') or self.name} syllabus",
                lambda: [Page(None, body)],
                mime_type="text/html", url=self.link("assignments/syllabus"),
            )

    def read_pages(self) -> None:
        for page in self.client.paginate(f"/api/v1/courses/{self.course_id}/pages", {"per_page": 100}):
            if page.get("locked_for_user") or page.get("hide_from_students") or not page.get("page_id"):
                continue
            slug = page.get("url") or ""

            def body(slug=slug):
                full = self.client.get_json(f"/api/v1/courses/{self.course_id}/pages/{quote(slug, safe='')}")
                return [Page(None, document_text.html_to_text(full.get("body")))] if full.get("body") else []

            self.upsert(
                "canvas_page", int(page["page_id"]), page.get("title") or slug, body,
                updated_at=parse_time(page.get("updated_at")), mime_type="text/html",
                url=self.link(f"pages/{quote(slug, safe='')}"), module=self.module_of("Page", slug),
            )

    def read_files(self) -> None:
        for item in self.client.paginate(f"/api/v1/courses/{self.course_id}/files", {"per_page": 100}):
            name = item.get("display_name") or item.get("filename") or "Untitled file"
            mime = document_text.kind_of(item.get("filename") or name, item.get("content-type"))
            if mime is None:
                continue  # not a PDF, slide deck or Word document
            if item.get("locked_for_user") or item.get("hidden_for_user") or item.get("locked") or item.get("hidden"):
                continue  # the student can't open it, so it isn't imported (and an old copy is removed)
            file_id = int(item["id"])
            if (item.get("size") or 0) > settings.canvas_max_file_bytes:
                self.seen.setdefault("canvas_file", set()).add(file_id)
                self.run.summary.skip(self.name, name, "larger than the import limit")
                continue
            download = item.get("url")
            if not download:
                continue

            def pages(download=download, mime=mime):
                return document_text.extract(
                    self.client.download(download, settings.canvas_max_file_bytes), mime
                )

            self.upsert(
                "canvas_file", file_id, name, pages,
                updated_at=parse_time(item.get("modified_at") or item.get("updated_at")),
                mime_type=mime, url=self.link(f"files/{file_id}"), module=self.module_of("File", file_id),
            )

    def read_announcements(self) -> None:
        for topic in self.client.paginate(
            f"/api/v1/courses/{self.course_id}/discussion_topics",
            {"only_announcements": "true", "per_page": 100},
        ):
            if topic.get("locked_for_user") or not topic.get("id"):
                continue
            text = document_text.html_to_text(topic.get("message"))
            if not text:
                continue
            topic_id = int(topic["id"])
            self.upsert(
                "canvas_announcement", topic_id, topic.get("title") or "Announcement",
                lambda text=text: [Page(None, text)],
                mime_type="text/html", url=self.link(f"discussion_topics/{topic_id}"),
            )

    def read_assignments(self) -> None:
        seen_deadlines: Set[int] = set()
        for assignment in self.client.paginate(
            f"/api/v1/courses/{self.course_id}/assignments", {"per_page": 100}
        ):
            if not assignment.get("id"):
                continue
            assignment_id = int(assignment["id"])
            title = assignment.get("name") or "Assignment"
            quiz = is_quiz(assignment)
            url = self.link(f"assignments/{assignment_id}")

            due = parse_time(assignment.get("due_at"))
            if due:
                seen_deadlines.add(assignment_id)
                self.save_deadline(assignment, assignment_id, title, due, url, quiz)

            # Quizzes and exams: the date only. Their questions are never imported.
            if quiz or assignment.get("locked_for_user"):
                continue
            text = document_text.html_to_text(assignment.get("description"))
            if text:
                self.upsert(
                    "canvas_assignment", assignment_id, title, lambda text=text: [Page(None, text)],
                    updated_at=parse_time(assignment.get("updated_at")), mime_type="text/html",
                    url=url, module=self.module_of("Assignment", assignment_id),
                )

        stale = self.db.query(Deadline).filter(
            Deadline.user_id == self.run.user_id, Deadline.canvas_course_id == self.course_id,
        )
        for deadline in stale.all():
            if deadline.canvas_assignment_id not in seen_deadlines:
                self.db.delete(deadline)
        self.db.commit()

    def save_deadline(self, assignment: dict, assignment_id: int, title: str, due, url: str, quiz: bool) -> None:
        deadline = (
            self.db.query(Deadline)
            .filter(
                Deadline.user_id == self.run.user_id,
                Deadline.canvas_course_id == self.course_id,
                Deadline.canvas_assignment_id == assignment_id,
            )
            .first()
        )
        if deadline is None:
            deadline = Deadline(
                user_id=self.run.user_id, canvas_course_id=self.course_id,
                canvas_assignment_id=assignment_id,
            )
            self.db.add(deadline)
        deadline.workspace_id = self.workspace.id
        deadline.title = title[:500]
        deadline.due_at = due
        deadline.url = url
        deadline.points_possible = assignment.get("points_possible")
        deadline.is_quiz = quiz
        deadline.updated_at = parse_time(assignment.get("updated_at"))
        self.db.commit()
        self.run.summary.deadlines += 1

    def run_all(self) -> None:
        try:
            self.step(0, "reading modules")
            self.read_modules()
            self.step(1, "syllabus")
            self.listed("canvas_syllabus", "Syllabus", self.read_syllabus)
            self.step(2, "pages")
            self.listed("canvas_page", "Pages", self.read_pages)
            self.step(3, "files")
            self.listed("canvas_file", "Files", self.read_files)
            self.step(4, "announcements")
            self.listed("canvas_announcement", "Announcements", self.read_announcements)
            self.step(5, "assignments")
            self.listed("canvas_assignment", "Assignments", self.read_assignments)
        except (CanvasForbidden, CanvasNotFound):
            # The whole course is gone or closed to the student. What was
            # imported from it stays until they delete it.
            self.db.rollback()
            self.run.summary.skip(self.name, "Course", "Canvas no longer lets you open this course")


def run_canvas_sync(user_id: str) -> None:
    """Background entry point. Never raises; failures are recorded on the connection."""
    db = get_session()
    connection = None
    try:
        connection = db.query(CanvasConnection).filter(CanvasConnection.user_id == user_id).first()
        user = db.get(User, user_id)
        if connection is None or user is None:
            return

        connection.sync_stage = "syncing"
        connection.sync_progress = 2
        connection.sync_detail = "Signing in to Canvas"
        connection.sync_error = None
        connection.sync_started_at = datetime.now(timezone.utc)
        db.commit()

        token = access_token_for(connection, db)
        courses = (
            db.query(Workspace)
            .filter(Workspace.user_id == user_id, Workspace.canvas_course_id.is_not(None))
            .order_by(Workspace.position, Workspace.id)
            .all()
        )

        with client_factory(connection.base_url, token) as client:
            # Canvas answers 401 both for a dead token and for a tab the student
            # can't see. Checking the token once here keeps the second case from
            # hiding the first.
            try:
                client.get_json("/api/v1/users/self")
            except CanvasForbidden:
                raise CanvasAuthError("Canvas didn't accept the saved sign-in. Connect Canvas again.")
            run = Run(db, connection, client, user)
            for index, workspace in enumerate(courses):
                CourseSync(run, workspace, index, len(courses)).run_all()

        connection.sync_stage = "ready"
        connection.sync_progress = 100
        connection.sync_detail = None
        connection.sync_summary = run.summary.to_json()
        connection.sync_finished_at = datetime.now(timezone.utc)
        db.commit()
        print(f"[Canvas] user={user_id} synced {len(courses)} course(s)")

    except (CanvasAuthError, CanvasError) as e:
        _record_failure(db, connection, str(e))
    except Exception:
        traceback.print_exc()
        _record_failure(db, connection, "The sync stopped unexpectedly. Try again.")
    finally:
        db.close()


def _record_failure(db: Session, connection: Optional[CanvasConnection], message: str) -> None:
    if connection is None:
        return
    try:
        db.rollback()
        connection.sync_stage = "failed"
        connection.sync_progress = 100
        connection.sync_detail = None
        connection.sync_error = message[:500]
        connection.sync_finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        print(f"[Canvas] could not record the failed sync of user={connection.user_id}")
