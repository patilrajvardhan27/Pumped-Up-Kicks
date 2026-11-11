"""Canvas courses: which course feeds which subject, and starting a sync."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import func

from api.deps import Ctx, RequestContext
from api.models.database import (
    Workspace,
)
from api.routes.workspaces import color_for, owned_workspace
from api.schemas.canvas import ConnectionStatus, CourseInfo, SyncRequest
from api.services import canvas_sync
from api.services.canvas_client import CanvasError
from api.services.canvas_connection import (
    STALE_SYNC,
    active_courses,
    client_for,
    require_connection,
    status_of,
    unique_name,
)
from api.services.ratelimit import rate_limit

router = APIRouter(prefix="/api/canvas", tags=["canvas"])


# --- courses and sync -------------------------------------------------------


@router.get("/courses", response_model=List[CourseInfo])
def list_courses(ctx: RequestContext = Ctx):
    """The student's active courses, live from Canvas, with the subject each one feeds."""
    connection = require_connection(ctx)
    linked = {
        course_id: workspace_id
        for workspace_id, course_id in ctx.db.query(Workspace.id, Workspace.canvas_course_id)
        .filter(Workspace.user_id == ctx.user_id, Workspace.canvas_course_id.is_not(None))
    }
    try:
        with client_for(ctx, connection) as client:
            courses = active_courses(client)
    except CanvasError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return [
        CourseInfo(
            id=int(c["id"]),
            name=c["name"],
            course_code=c.get("course_code"),
            term=(c.get("term") or {}).get("name"),
            workspace_id=linked.get(int(c["id"])),
        )
        for c in courses
    ]


@router.post(
    "/sync",
    response_model=ConnectionStatus,
    dependencies=[rate_limit("canvas-sync", 6)],
)
def start_sync(request: SyncRequest, background_tasks: BackgroundTasks, ctx: RequestContext = Ctx):
    """Apply course links, then import in the background. Poll GET /connection for progress."""
    connection = require_connection(ctx)

    running = connection.sync_stage in ("queued", "syncing")
    last_heard = connection.sync_started_at or connection.created_at
    if running and last_heard and datetime.now(timezone.utc) - last_heard < STALE_SYNC:
        raise HTTPException(status_code=409, detail="A Canvas sync is already running.")

    for course_id in request.unlink:
        ctx.db.query(Workspace).filter(
            Workspace.user_id == ctx.user_id, Workspace.canvas_course_id == course_id
        ).update({Workspace.canvas_course_id: None}, synchronize_session=False)

    if request.link:
        # Only courses Canvas says this student is enrolled in can be linked.
        try:
            with client_for(ctx, connection) as client:
                courses = {int(c["id"]): c for c in active_courses(client)}
        except CanvasError as e:
            raise HTTPException(status_code=502, detail=str(e))

        for link in request.link:
            course = courses.get(link.course_id)
            if course is None:
                raise HTTPException(status_code=404, detail="That course isn't one of your active Canvas courses.")

            target = (
                owned_workspace(ctx, link.workspace_id)
                if link.workspace_id is not None
                else Workspace(
                    user_id=ctx.user_id,
                    name=unique_name(ctx, course["name"]),
                    color=color_for(ctx.db.query(Workspace).filter(Workspace.user_id == ctx.user_id).count()),
                    icon="book",
                    position=(ctx.db.query(func.max(Workspace.position))
                              .filter(Workspace.user_id == ctx.user_id).scalar() or 0) + 1,
                )
            )
            if target.canvas_course_id not in (None, link.course_id):
                raise HTTPException(
                    status_code=409,
                    detail=f"'{target.name}' already gets its material from another course.",
                )
            # Any other subject this course fed lets go of it, and what was
            # imported from it moves to the new subject on this sync.
            ctx.db.query(Workspace).filter(
                Workspace.user_id == ctx.user_id,
                Workspace.canvas_course_id == link.course_id,
            ).update({Workspace.canvas_course_id: None}, synchronize_session=False)
            ctx.db.flush()
            target.canvas_course_id = link.course_id
            ctx.db.add(target)
            ctx.db.flush()

    connection.sync_stage = "queued"
    connection.sync_progress = 0
    connection.sync_detail = "Waiting to start"
    connection.sync_error = None
    connection.sync_started_at = datetime.now(timezone.utc)
    ctx.db.commit()

    background_tasks.add_task(canvas_sync.run_canvas_sync, ctx.user_id)
    return status_of(connection)
