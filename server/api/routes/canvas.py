"""
Canvas: connect (OAuth2, or a personal token in local development), choose
which courses feed which subjects, sync, and disconnect.

Nothing here ever returns a token. The OAuth callback is the one route without
an Authorization header (it is a browser redirect from Canvas), so it saves
nothing: it checks the signed `state` and hands the code on to the web app. The
signed-in app then posts the code to /oauth/complete, which checks that the
state was issued to that same user and has not been used before.
"""

from fastapi import APIRouter, HTTPException

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import (
    Deadline,
    Document,
)
from api.schemas.canvas import CompleteRequest, ConnectionStatus, StartRequest, StartResponse, TokenRequest
from api.services import canvas_auth, canvas_sync, net_guard
from api.services.canvas_auth import CanvasAuthError
from api.services.canvas_client import CanvasError
from api.services.canvas_connection import (
    app_redirect,
    find_connection,
    origin_of,
    require_connection,
    save_connection,
    status_of,
    unlink_all,
)
from api.services.cleanup import revoke_canvas
from api.services.ratelimit import rate_limit

router = APIRouter(prefix="/api/canvas", tags=["canvas"])


# --- connect ----------------------------------------------------------------


@router.get("/connection", response_model=ConnectionStatus)
def get_connection(ctx: RequestContext = Ctx):
    """Polled by the client while a sync runs."""
    connection = find_connection(ctx)
    if connection is not None:
        ctx.db.refresh(connection)
    return status_of(connection)


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
    nonce = canvas_auth.new_nonce()
    try:
        url = canvas_auth.authorize_url(ctx.user_id, base_url, nonce)
    except CanvasAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    canvas_auth.remember_nonce(ctx.db, ctx.user_id, nonce)
    return StartResponse(authorize_url=url)


@router.get("/oauth/callback", include_in_schema=False)
def oauth_callback(state: str = "", code: str = "", error: str = ""):
    """
    Canvas sends the browser here. Nothing is saved: the state is checked and the
    code goes to the web app, which finishes the sign-in as the signed-in user.
    """
    try:
        canvas_auth.read_state(state)
    except CanvasAuthError:
        return app_redirect(canvas_error="invalid")

    if error or not code:
        return app_redirect(canvas_error="denied")

    return app_redirect(canvas_code=code, canvas_state=state)


@router.post(
    "/oauth/complete",
    response_model=ConnectionStatus,
    dependencies=[rate_limit("canvas", 20)],
)
def complete_oauth(request: CompleteRequest, ctx: RequestContext = Ctx):
    """Finish a Canvas sign-in: trade the code for tokens, for the user the sign-in was started by."""
    try:
        user_id, base_url, nonce = canvas_auth.read_state_with_nonce(request.state)
    except CanvasAuthError:
        raise HTTPException(status_code=400, detail="The Canvas sign-in link expired. Try again.")
    if user_id != ctx.user_id:
        raise HTTPException(status_code=403, detail="This sign-in belongs to another account.")
    if not canvas_auth.consume_nonce(ctx.db, ctx.user_id, nonce):
        raise HTTPException(status_code=400, detail="That Canvas sign-in was already used or has expired. Start again.")

    try:
        grant = canvas_auth.exchange_code(base_url, request.code)
    except CanvasAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return status_of(save_connection(ctx.db, ctx.user_id, base_url, "oauth", grant))


@router.post(
    "/token",
    response_model=ConnectionStatus,
    dependencies=[rate_limit("canvas", 20)],
)
def connect_with_token(request: TokenRequest, ctx: RequestContext = Ctx):
    """Local development only: connect with a personal access token."""
    if not settings.canvas_allow_personal_tokens:
        raise HTTPException(status_code=403, detail="Connect Canvas through your school's sign-in instead.")
    base_url = origin_of(request.base_url)

    try:
        with canvas_sync.client_factory(base_url, request.token) as client:
            me = client.get_json("/api/v1/users/self")
    except CanvasError:
        raise HTTPException(status_code=400, detail="Canvas didn't accept that token.")

    grant = canvas_auth.TokenGrant(
        access_token=request.token, refresh_token=None, expires_at=None,
        canvas_user_id=me.get("id") if isinstance(me, dict) else None,
    )
    return status_of(save_connection(ctx.db, ctx.user_id, base_url, "personal_token", grant))


@router.delete("/connection")
def disconnect(delete_material: bool = False, ctx: RequestContext = Ctx):
    """
    Forget the Canvas sign-in: the stored tokens are deleted (and revoked at
    Canvas when it can be reached) and courses stop feeding subjects. With
    delete_material=true the imported documents and deadlines go too.
    """
    connection = require_connection(ctx)
    revoke_canvas(connection)

    unlink_all(ctx.db, ctx.user_id)
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
