"""
What a chat searches.

A conversation searches one lecture, one subject (workspace), the lectures
filed under no subject ("Unsorted"), or everything the user owns. Retrieval and
the answer cache both take their scope from here, so a question asked in one
subject is never answered from another subject's lectures, or from an answer
cached for another subject.

The scope only ever narrows a search. The owner filter on every chunk query is
applied on top of it, whatever the scope says.
"""
from dataclasses import dataclass
from typing import Literal, Optional

ScopeKind = Literal["video", "workspace", "all"]


@dataclass(frozen=True)
class ChatScope:
    kind: ScopeKind = "all"
    video_id: Optional[int] = None
    # With kind "workspace", None means the Unsorted lectures.
    workspace_id: Optional[int] = None

    @classmethod
    def of(cls, conversation) -> "ChatScope":
        """The scope a stored conversation searches."""
        if conversation.scope == "video":
            return cls("video", video_id=conversation.video_id)
        if conversation.scope == "workspace":
            return cls("workspace", workspace_id=conversation.workspace_id)
        return cls("all")

    @property
    def cache_token(self) -> str:
        """Part of the answer-cache key, so a cached answer stays inside its scope."""
        if self.kind == "video":
            return f"video:{self.video_id}"
        if self.kind == "workspace":
            return f"workspace:{'unsorted' if self.workspace_id is None else self.workspace_id}"
        return "all"


ALL = ChatScope()
