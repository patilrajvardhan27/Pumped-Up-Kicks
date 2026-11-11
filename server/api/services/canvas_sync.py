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
import traceback
from datetime import datetime, timezone
from typing import Callable, Optional

from sqlalchemy.orm import Session

from api.models.database import (
    CanvasConnection,
    User,
    Workspace,
    get_session,
)
from api.services.canvas_auth import CanvasAuthError, access_token_for
from api.services.canvas_client import CanvasClient, CanvasError, CanvasForbidden
from api.services.canvas_course import Run
from api.services.canvas_readers import CourseSync

# Swapped in tests for a client on recorded responses.
client_factory: Callable[[str, str], CanvasClient] = CanvasClient


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
