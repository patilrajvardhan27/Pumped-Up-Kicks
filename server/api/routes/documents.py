"""Course material imported into a user's subjects (see api/services/canvas_sync.py)."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.deps import Ctx, RequestContext
from api.models.database import Document

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentInfo(BaseModel):
    id: int
    workspace_id: Optional[int] = None
    source: str
    title: str
    mime_type: Optional[str] = None
    url: Optional[str] = None
    module_name: Optional[str] = None
    module_position: Optional[int] = None
    num_pages: Optional[int] = None
    num_chunks: int
    updated_at: Optional[str] = None


def to_info(document: Document) -> DocumentInfo:
    return DocumentInfo(
        id=document.id,
        workspace_id=document.workspace_id,
        source=document.source,
        title=document.title,
        mime_type=document.mime_type,
        url=document.url,
        module_name=document.module_name,
        module_position=document.module_position,
        num_pages=document.num_pages,
        num_chunks=document.num_chunks,
        updated_at=document.updated_at.isoformat() if document.updated_at else None,
    )


@router.get("", response_model=List[DocumentInfo])
def list_documents(
    workspace_id: Optional[int] = None,
    unsorted: bool = False,
    ctx: RequestContext = Ctx,
):
    """This user's documents, optionally only one subject's or only those in no subject."""
    query = ctx.db.query(Document).filter(Document.user_id == ctx.user_id)
    if workspace_id is not None:
        query = query.filter(Document.workspace_id == workspace_id)
    elif unsorted:
        query = query.filter(Document.workspace_id.is_(None))
    documents = query.order_by(
        Document.module_position.asc().nulls_last(), Document.source, Document.title
    ).all()
    return [to_info(d) for d in documents]


@router.delete("/{document_id}")
def delete_document(document_id: int, ctx: RequestContext = Ctx):
    """Removes one imported item and its index. A later sync brings it back if it is still in Canvas."""
    document = (
        ctx.db.query(Document)
        .filter(Document.id == document_id, Document.user_id == ctx.user_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    title = document.title
    ctx.db.delete(document)
    ctx.db.commit()
    return {"message": f"'{title}' deleted."}
