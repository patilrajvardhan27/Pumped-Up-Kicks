"""
Subject workspaces: one per subject, each holding its own lectures and chats.

Lectures and chats that belong to no workspace are "Unsorted". Deleting a
workspace never deletes what was in it; the foreign keys move it to Unsorted.
"""
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import Video, Workspace

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

NAME_MAX_CHARS = 60

# The client maps these onto design tokens and icons. Kept to a fixed set so a
# workspace can never carry arbitrary styling.
WorkspaceColor = Literal["blue", "green", "red", "purple", "teal", "olive"]
WorkspaceIcon = Literal[
    "book", "flask", "function", "code", "globe", "atom",
    "dna", "chart", "palette", "music", "scales", "brain",
]


# --- schemas ----------------------------------------------------------------


def _clean_name(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("Give the subject a name.")
    return cleaned


class WorkspaceInfo(BaseModel):
    id: int
    name: str
    color: str
    icon: str
    position: int
    canvas_course_id: Optional[int] = None
    video_count: int = 0
    created_at: str


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=NAME_MAX_CHARS)
    color: WorkspaceColor = "blue"
    icon: WorkspaceIcon = "book"

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return _clean_name(value)


class WorkspaceUpdate(BaseModel):
    """Rename, recolour or change the icon. Fields left out are unchanged."""

    name: Optional[str] = Field(None, min_length=1, max_length=NAME_MAX_CHARS)
    color: Optional[WorkspaceColor] = None
    icon: Optional[WorkspaceIcon] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: Optional[str]) -> Optional[str]:
        return _clean_name(value)


class WorkspaceOrder(BaseModel):
    """Every one of the user's workspace ids, in the order to show them."""

    workspace_ids: List[int] = Field(..., max_length=1000)


# --- helpers ----------------------------------------------------------------


def owned_workspace(ctx: RequestContext, workspace_id: int) -> Workspace:
    """The caller's workspace, or a 404 that does not reveal whether it exists."""
    workspace = (
        ctx.db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.user_id == ctx.user_id)
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Subject not found")
    return workspace


def _video_counts(ctx: RequestContext) -> dict[int, int]:
    rows = (
        ctx.db.query(Video.workspace_id, func.count(Video.id))
        .filter(Video.user_id == ctx.user_id, Video.workspace_id.is_not(None))
        .group_by(Video.workspace_id)
        .all()
    )
    return {workspace_id: count for workspace_id, count in rows}


def _to_info(workspace: Workspace, counts: dict[int, int]) -> WorkspaceInfo:
    created = workspace.created_at or datetime.now()
    return WorkspaceInfo(
        id=workspace.id,
        name=workspace.name,
        color=workspace.color,
        icon=workspace.icon,
        position=workspace.position,
        canvas_course_id=workspace.canvas_course_id,
        video_count=counts.get(workspace.id, 0),
        created_at=created.isoformat(),
    )


def _ordered(ctx: RequestContext) -> List[Workspace]:
    return (
        ctx.db.query(Workspace)
        .filter(Workspace.user_id == ctx.user_id)
        .order_by(Workspace.position, Workspace.id)
        .all()
    )


def _name_taken(ctx: RequestContext, name: str, except_id: Optional[int] = None) -> bool:
    query = ctx.db.query(Workspace.id).filter(
        Workspace.user_id == ctx.user_id, Workspace.name == name
    )
    if except_id is not None:
        query = query.filter(Workspace.id != except_id)
    return query.first() is not None


def _conflict(name: str) -> HTTPException:
    return HTTPException(status_code=409, detail=f"You already have a subject called '{name}'.")


# --- routes -----------------------------------------------------------------


@router.get("", response_model=List[WorkspaceInfo])
def list_workspaces(ctx: RequestContext = Ctx):
    counts = _video_counts(ctx)
    return [_to_info(w, counts) for w in _ordered(ctx)]


@router.post("", response_model=WorkspaceInfo, status_code=201)
def create_workspace(request: WorkspaceCreate, ctx: RequestContext = Ctx):
    existing = _ordered(ctx)
    if len(existing) >= settings.max_workspaces_per_user:
        raise HTTPException(
            status_code=400,
            detail=f"You can have up to {settings.max_workspaces_per_user} subjects.",
        )
    if _name_taken(ctx, request.name):
        raise _conflict(request.name)

    workspace = Workspace(
        user_id=ctx.user_id,
        name=request.name,
        color=request.color,
        icon=request.icon,
        position=(max(w.position for w in existing) + 1) if existing else 0,
    )
    ctx.db.add(workspace)
    try:
        ctx.db.commit()
    except IntegrityError:
        # Two creates with the same name raced past the check above.
        ctx.db.rollback()
        raise _conflict(request.name)
    ctx.db.refresh(workspace)
    return _to_info(workspace, {})


@router.patch("/{workspace_id}", response_model=WorkspaceInfo)
def update_workspace(workspace_id: int, request: WorkspaceUpdate, ctx: RequestContext = Ctx):
    workspace = owned_workspace(ctx, workspace_id)

    if request.name is not None and request.name != workspace.name:
        if _name_taken(ctx, request.name, except_id=workspace.id):
            raise _conflict(request.name)
        workspace.name = request.name
    if request.color is not None:
        workspace.color = request.color
    if request.icon is not None:
        workspace.icon = request.icon

    try:
        ctx.db.commit()
    except IntegrityError:
        ctx.db.rollback()
        raise _conflict(request.name or workspace.name)
    ctx.db.refresh(workspace)
    return _to_info(workspace, _video_counts(ctx))


@router.put("/order", response_model=List[WorkspaceInfo])
def reorder_workspaces(request: WorkspaceOrder, ctx: RequestContext = Ctx):
    """Set the sidebar order. The list must name each of the caller's workspaces once."""
    workspaces = {w.id: w for w in _ordered(ctx)}
    ids = request.workspace_ids

    if len(ids) != len(set(ids)) or set(ids) != set(workspaces):
        raise HTTPException(
            status_code=400,
            detail="The order must list each of your subjects exactly once.",
        )

    for position, workspace_id in enumerate(ids):
        workspaces[workspace_id].position = position
    ctx.db.commit()

    counts = _video_counts(ctx)
    return [_to_info(w, counts) for w in _ordered(ctx)]


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int, ctx: RequestContext = Ctx):
    """Deletes the subject only. Its lectures and chats move to Unsorted."""
    workspace = owned_workspace(ctx, workspace_id)
    name = workspace.name

    # videos.workspace_id and conversations.workspace_id are ON DELETE SET NULL.
    ctx.db.delete(workspace)
    ctx.db.commit()

    return {"message": f"'{name}' deleted. Its lectures and chats are now in Unsorted."}
