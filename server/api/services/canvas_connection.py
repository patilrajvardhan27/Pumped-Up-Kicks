"""
Reading and saving a user's Canvas connection, and the small helpers both Canvas
routers share.
"""
import json
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlencode

from fastapi import HTTPException
from fastapi.responses import RedirectResponse

from api.config import settings
from api.deps import RequestContext
from api.models.database import (
    CanvasConnection,
    Workspace,
)
from api.schemas.canvas import ConnectionStatus, SyncStatus
from api.services import canvas_auth, canvas_sync, net_guard
from api.services.canvas_auth import CanvasAuthError
from api.services.canvas_client import CanvasClient

# --- helpers ----------------------------------------------------------------

# A sync that has said nothing for this long is assumed lost (a restart) and may be restarted.
STALE_SYNC = timedelta(hours=1)


def iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def find_connection(ctx: RequestContext) -> Optional[CanvasConnection]:
    return (
        ctx.db.query(CanvasConnection)
        .filter(CanvasConnection.user_id == ctx.user_id)
        .first()
    )


def require_connection(ctx: RequestContext) -> CanvasConnection:
    connection = find_connection(ctx)
    if connection is None:
        raise HTTPException(status_code=404, detail="Canvas isn't connected.")
    return connection


def status_of(connection: Optional[CanvasConnection]) -> ConnectionStatus:
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
        connected_at=iso(connection.created_at),
        sync=SyncStatus(
            stage=connection.sync_stage,
            progress=connection.sync_progress,
            detail=connection.sync_detail,
            error=connection.sync_error,
            started_at=iso(connection.sync_started_at),
            finished_at=iso(connection.sync_finished_at),
            summary=summary,
        ),
        **offered,
    )


def origin_of(raw: str) -> str:
    try:
        return net_guard.check_https_origin(raw)
    except net_guard.UnsafeAddress as e:
        raise HTTPException(status_code=400, detail=str(e))


def save_connection(
    db, user_id: str, base_url: str, auth_type: str, grant: canvas_auth.TokenGrant
) -> CanvasConnection:
    """Store (or replace) the user's one connection. A new school drops links to the old one's courses."""
    connection = db.query(CanvasConnection).filter(CanvasConnection.user_id == user_id).first()
    if connection is not None and connection.base_url != base_url:
        unlink_all(db, user_id)
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


def unlink_all(db, user_id: str) -> None:
    db.query(Workspace).filter(
        Workspace.user_id == user_id, Workspace.canvas_course_id.is_not(None)
    ).update({Workspace.canvas_course_id: None}, synchronize_session=False)


def client_for(ctx: RequestContext, connection: CanvasConnection) -> CanvasClient:
    try:
        token = canvas_auth.access_token_for(connection, ctx.db)
    except CanvasAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return canvas_sync.client_factory(connection.base_url, token)


def active_courses(client: CanvasClient) -> List[dict]:
    courses = client.paginate(
        "/api/v1/courses",
        {"enrollment_state": "active", "enrollment_type": "student", "include[]": "term", "per_page": 100},
    )
    # Courses outside their dates come back as stubs the student can't open.
    return [c for c in courses if c.get("id") and c.get("name") and not c.get("access_restricted_by_date")]


def unique_name(ctx: RequestContext, wanted: str) -> str:
    base = " ".join(wanted.split())[:55] or "Canvas course"
    taken = {name for (name,) in ctx.db.query(Workspace.name).filter(Workspace.user_id == ctx.user_id)}
    if base not in taken:
        return base
    n = 2
    while f"{base} ({n})" in taken:
        n += 1
    return f"{base} ({n})"


def app_redirect(**params) -> RedirectResponse:
    return RedirectResponse(f"{settings.public_app_url.rstrip('/')}/app?{urlencode(params)}", status_code=302)
