"""
Canvas: connect (OAuth2, or a personal token in local development), choose
which courses feed which subjects, sync, and disconnect.

Nothing here ever returns a token. The OAuth callback is the one route without
an Authorization header (it is a browser redirect from Canvas), so, like the
signed media route in videos.py, it opens its own session and takes the user
from the signed `state` instead.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import (
    CanvasConnection,
    Deadline,
    Document,
    Workspace,
    get_session,
)
from api.routes.workspaces import owned_workspace
from api.services import canvas_auth, canvas_sync, net_guard
from api.services.canvas_auth import CanvasAuthError
from api.services.canvas_client import CanvasClient, CanvasError
from api.services.ratelimit import rate_limit

router = APIRouter(prefix="/api/canvas", tags=["canvas"])

# A sync that has said nothing for this long is assumed lost (a restart) and may be restarted.
STALE_SYNC = timedelta(hours=1)


# --- schemas ----------------------------------------------------------------


class SyncStatus(BaseModel):
    stage: str
    progress: int
    detail: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    summary: Optional[dict] = None


class ConnectionStatus(BaseModel):
    connected: bool
    base_url: Optional[str] = None
    auth_type: Optional[str] = None
    connected_at: Optional[str] = None
    sync: Optional[SyncStatus] = None
    # What this server offers, so the client knows which way to connect.
    schools: List[str] = []
    personal_tokens_allowed: bool = False


class StartRequest(BaseModel):
    base_url: str = Field(..., min_length=1, max_length=255)


class StartResponse(BaseModel):
    authorize_url: str


class TokenRequest(BaseModel):
    base_url: str = Field(..., min_length=1, max_length=255)
    token: str = Field(..., min_length=10, max_length=512)


class CourseInfo(BaseModel):
    id: int
    name: str
    course_code: Optional[str] = None
    term: Optional[str] = None
    workspace_id: Optional[int] = None


class CourseLink(BaseModel):
    course_id: int
    # The subject to fill from this course; null creates one named after it.
    workspace_id: Optional[int] = None


class SyncRequest(BaseModel):
    """Courses to link (or re-link) before syncing, and courses to stop syncing."""

    link: List[CourseLink] = Field(default_factory=list, max_length=200)
    unlink: List[int] = Field(default_factory=list, max_length=200)


# --- helpers ----------------------------------------------------------------


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _connection(ctx: RequestContext) -> Optional[CanvasConnection]:
    return (
        ctx.db.query(CanvasConnection)
        .filter(CanvasConnection.user_id == ctx.user_id)
        .first()
    )


def _required(ctx: RequestContext) -> CanvasConnection:
    connection = _connection(ctx)
    if connection is None:
        raise HTTPException(status_code=404, detail="Canvas isn't connected.")
    return connection


def _status(connection: Optional[CanvasConnection]) -> ConnectionStatus:
    offered = dict(
        schools=sorted(settings.canvas_oauth_client_map),
        personal_tokens_allowed=settings.canvas_allow_personal_tokens,
    )
    if connection is None:
        return ConnectionStatus(connected=False, **offered)
    summary = None
    if connection.sync_summary:
        try:
            summary = json.loads(connection.sync_summary)
        except ValueError:
            summary = None
    return ConnectionStatus(
        connected=True,
        base_url=connection.base_url,
        auth_type=connection.auth_type,
        connected_at=_iso(connection.created_at),
        sync=SyncStatus(
            stage=connection.sync_stage,
            progress=connection.sync_progress,
            detail=connection.sync_detail,
            error=connection.sync_error,
            started_at=_iso(connection.sync_started_at),
            finished_at=_iso(connection.sync_finished_at),
            summary=summary,
        ),
        **offered,
    )


def _origin(raw: str) -> str:
    try:
        return net_guard.check_https_origin(raw)
    except net_guard.UnsafeAddress as e:
        raise HTTPException(status_code=400, detail=str(e))


def _save_connection(
    db, user_id: str, base_url: str, auth_type: str, grant: canvas_auth.TokenGrant
) -> CanvasConnection:
    """Store (or replace) the user's one connection. A new school drops links to the old one's courses."""
    connection = db.query(CanvasConnection).filter(CanvasConnection.user_id == user_id).first()
    if connection is not None and connection.base_url != base_url:
        _unlink_all(db, user_id)
    if connection is None:
        connection = CanvasConnection(user_id=user_id, sync_stage="idle", sync_progress=0)
        db.add(connection)
    connection.base_url = base_url
    connection.auth_type = auth_type
    connection.access_token_enc = canvas_auth.encrypt_token(grant.access_token)
    connection.refresh_token_enc = (
        canvas_auth.encrypt_token(grant.refresh_token) if grant.refresh_token else None
    )
    connection.expires_at = grant.expires_at
    connection.canvas_user_id = grant.canvas_user_id
    db.commit()
    return connection


def _unlink_all(db, user_id: str) -> None:
    db.query(Workspace).filter(
        Workspace.user_id == user_id, Workspace.canvas_course_id.is_not(None)
    ).update({Workspace.canvas_course_id: None}, synchronize_session=False)


def _client(ctx: RequestContext, connection: CanvasConnection) -> CanvasClient:
    try:
        token = canvas_auth.access_token_for(connection, ctx.db)
    except CanvasAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return canvas_sync.client_factory(connection.base_url, token)


def _active_courses(client: CanvasClient) -> List[dict]:
    courses = client.paginate(
        "/api/v1/courses",
        {"enrollment_state": "active", "enrollment_type": "student", "include[]": "term", "per_page": 100},
    )
    # Courses outside their dates come back as stubs the student can't open.
    return [c for c in courses if c.get("id") and c.get("name") and not c.get("access_restricted_by_date")]


def _unique_name(ctx: RequestContext, wanted: str) -> str:
    base = " ".join(wanted.split())[:55] or "Canvas course"
    taken = {name for (name,) in ctx.db.query(Workspace.name).filter(Workspace.user_id == ctx.user_id)}
    if base not in taken:
        return base
    n = 2
    while f"{base} ({n})" in taken:
        n += 1
    return f"{base} ({n})"


def _app_redirect(**params) -> RedirectResponse:
    return RedirectResponse(f"{settings.public_app_url.rstrip('/')}/app?{urlencode(params)}", status_code=302)


# --- connect ----------------------------------------------------------------


@router.get("/connection", response_model=ConnectionStatus)
def get_connection(ctx: RequestContext = Ctx):
    """Polled by the client while a sync runs."""
    connection = _connection(ctx)
    if connection is not None:
        ctx.db.refresh(connection)
    return _status(connection)


@router.post(
    "/oauth/start",
    response_model=StartResponse,
    dependencies=[rate_limit("canvas", 20)],
)
def start_oauth(request: StartRequest, ctx: RequestContext = Ctx):
    """The Canvas page to send the browser to. Only schools with a developer key can be used."""
    try:
        # The browser goes there, not this server, so no lookup is needed yet;
        # the token exchange later goes through net_guard like every request.
        base_url = net_guard.normalize_https_origin(request.base_url)
    except net_guard.UnsafeAddress as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        return StartResponse(authorize_url=canvas_auth.authorize_url(ctx.user_id, base_url))
    except CanvasAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/oauth/callback", include_in_schema=False)
def oauth_callback(state: str = "", code: str = "", error: str = ""):
    """Canvas sends the browser here. Finish the exchange, then send the student back to the app."""
    try:
        user_id, base_url = canvas_auth.read_state(state)
    except CanvasAuthError:
        return _app_redirect(canvas="error", reason="The Canvas sign-in link expired. Try again.")

    if error or not code:
        return _app_redirect(canvas="denied")

    db = get_session()
    try:
        grant = canvas_auth.exchange_code(base_url, code)
        _save_connection(db, user_id, base_url, "oauth", grant)
    except CanvasAuthError as e:
        return _app_redirect(canvas="error", reason=str(e))
    finally:
        db.close()

    return _app_redirect(canvas="connected")


@router.post(
    "/token",
    response_model=ConnectionStatus,
    dependencies=[rate_limit("canvas", 20)],
)
def connect_with_token(request: TokenRequest, ctx: RequestContext = Ctx):
    """Local development only: connect with a personal access token."""
    if not settings.canvas_allow_personal_tokens:
        raise HTTPException(status_code=403, detail="Connect Canvas through your school's sign-in instead.")
    base_url = _origin(request.base_url)

    try:
        with canvas_sync.client_factory(base_url, request.token) as client:
            me = client.get_json("/api/v1/users/self")
    except CanvasError:
        raise HTTPException(status_code=400, detail="Canvas didn't accept that token.")

    grant = canvas_auth.TokenGrant(
        access_token=request.token, refresh_token=None, expires_at=None,
        canvas_user_id=me.get("id") if isinstance(me, dict) else None,
    )
    return _status(_save_connection(ctx.db, ctx.user_id, base_url, "personal_token", grant))


@router.delete("/connection")
def disconnect(delete_material: bool = False, ctx: RequestContext = Ctx):
    """
    Forget the Canvas sign-in: the stored tokens are deleted (and revoked at
    Canvas when it can be reached) and courses stop feeding subjects. With
    delete_material=true the imported documents and deadlines go too.
    """
    connection = _required(ctx)
    if connection.auth_type == "oauth":
        try:
            canvas_auth.revoke(connection.base_url, canvas_auth.decrypt_token(connection.access_token_enc))
        except CanvasAuthError:
            pass

    _unlink_all(ctx.db, ctx.user_id)
    ctx.db.delete(connection)

    removed = 0
    if delete_material:
        removed = (
            ctx.db.query(Document)
            .filter(Document.user_id == ctx.user_id, Document.source.like("canvas_%"))
            .delete(synchronize_session=False)
        )
        ctx.db.query(Deadline).filter(Deadline.user_id == ctx.user_id).delete(synchronize_session=False)
    ctx.db.commit()

    if delete_material:
        return {"message": f"Canvas disconnected. {removed} imported items were deleted."}
    return {"message": "Canvas disconnected. Imported material stays until you delete it."}


# --- courses and sync -------------------------------------------------------


@router.get("/courses", response_model=List[CourseInfo])
def list_courses(ctx: RequestContext = Ctx):
    """The student's active courses, live from Canvas, with the subject each one feeds."""
    connection = _required(ctx)
    linked = {
        course_id: workspace_id
        for workspace_id, course_id in ctx.db.query(Workspace.id, Workspace.canvas_course_id)
        .filter(Workspace.user_id == ctx.user_id, Workspace.canvas_course_id.is_not(None))
    }
    try:
        with _client(ctx, connection) as client:
            courses = _active_courses(client)
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
    connection = _required(ctx)

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
            with _client(ctx, connection) as client:
                courses = {int(c["id"]): c for c in _active_courses(client)}
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
                    name=_unique_name(ctx, course["name"]),
                    color="blue",
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
    return _status(connection)
