"""
What a chat searches: one lecture, one subject, Unsorted, or everything, and an
answer cache that never crosses those lines. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_chat_scope
"""
import json

from api.models.database import AnswerCache
from api.services.lecture_rag_service import LectureRAGService
from api.services.scope import ALL, ChatScope
from tests import support


def setup_library():
    """Two subjects and one unsorted lecture, all mentioning entropy."""
    support.fresh()
    api = support.client("alice")
    physics = api.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    biology = api.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    thermo = support.add_video("alice", "Thermo", ["entropy always increases in a closed system"], physics)
    cells = support.add_video("alice", "Cells", ["entropy and the energy budget of a cell"], biology)
    loose = support.add_video("alice", "Loose", ["entropy in information theory"])
    return api, physics, biology, thermo, cells, loose


def lectures(sources):
    return {s["video"] for s in sources}


def retrieve(scope):
    db = support.session()
    try:
        return LectureRAGService().retrieve(db, "alice", "what is entropy", scope=scope, top_k=10)
    finally:
        db.close()


def test_retrieval_respects_each_scope():
    _, physics, biology, thermo, _, _ = setup_library()

    assert lectures(retrieve(ALL)) == {"Thermo", "Cells", "Loose"}
    assert lectures(retrieve(ChatScope("workspace", workspace_id=physics))) == {"Thermo"}
    assert lectures(retrieve(ChatScope("workspace", workspace_id=biology))) == {"Cells"}
    assert lectures(retrieve(ChatScope("workspace", workspace_id=None))) == {"Loose"}
    assert lectures(retrieve(ChatScope("video", video_id=thermo))) == {"Thermo"}


def test_workspace_chat_only_sends_that_subjects_excerpts():
    api, physics, *_ = setup_library()
    claude = support.use_claude()

    response = api.post(
        "/api/chat/stream",
        json={"question": "what is entropy", "scope": "workspace", "workspace_id": physics},
    )
    events = [json.loads(line[5:]) for line in response.text.split("\n\n") if line.startswith("data:")]
    done = next(e for e in events if e["type"] == "done")

    assert lectures(done["sources"]) == {"Thermo"}
    assert "Cells" not in claude.prompts[0] and "Loose" not in claude.prompts[0]

    conversation_id = events[0]["conversation_id"]
    detail = api.get(f"/api/chat/conversations/{conversation_id}").json()
    assert detail["scope"] == "workspace" and detail["workspace_id"] == physics

    # A follow-up in the same thread keeps the thread's scope, whatever the request says.
    api.post("/api/chat/stream", json={
        "question": "what is entropy", "conversation_id": conversation_id, "scope": "all",
    })
    assert "Cells" not in claude.prompts[1]


def test_legacy_requests_keep_their_old_meaning():
    api, _, _, thermo, _, _ = setup_library()
    support.use_claude()

    by_video = api.post("/api/chat/query", json={"question": "entropy", "video_id": thermo}).json()
    assert lectures(by_video["sources"]) == {"Thermo"}

    everything = api.post("/api/chat/query", json={"question": "entropy"}).json()
    assert lectures(everything["sources"]) == {"Thermo", "Cells", "Loose"}

    scopes = {c["id"]: c["scope"] for c in api.get("/api/chat/conversations").json()}
    assert scopes == {by_video["conversation_id"]: "video", everything["conversation_id"]: "all"}


def test_conversation_filters():
    api, physics, _, thermo, _, _ = setup_library()
    support.use_claude()

    in_physics = api.post("/api/chat/query", json={
        "question": "entropy", "scope": "workspace", "workspace_id": physics,
    }).json()["conversation_id"]
    about_thermo = api.post("/api/chat/query", json={
        "question": "entropy", "video_id": thermo,
    }).json()["conversation_id"]
    in_unsorted = api.post("/api/chat/query", json={
        "question": "entropy", "scope": "workspace",
    }).json()["conversation_id"]
    everywhere = api.post("/api/chat/query", json={"question": "entropy"}).json()["conversation_id"]

    ids = lambda query: {c["id"] for c in api.get(f"/api/chat/conversations{query}").json()}  # noqa: E731
    assert ids(f"?workspace_id={physics}") == {in_physics, about_thermo}
    assert ids("?unsorted=true") == {in_unsorted}
    assert ids("") == {in_physics, about_thermo, in_unsorted, everywhere}


def test_cache_key_carries_the_scope():
    source = {"chunk_id": 7}
    keys = {
        LectureRAGService.cache_key("q", [source], "m", scope)
        for scope in (
            ALL,
            ChatScope("workspace", workspace_id=1),
            ChatScope("workspace", workspace_id=2),
            ChatScope("workspace", workspace_id=None),
            ChatScope("video", video_id=1),
        )
    }
    assert len(keys) == 5, "the same excerpts in different scopes must not share an answer"


def test_cached_answer_is_not_served_in_another_subject():
    """
    A lecture that moves subjects keeps its chunks, so the new subject can
    retrieve exactly the excerpts the old one did. The cached answer must still
    stay with the subject it was asked in.
    """
    api, physics, biology, thermo, cells, _ = setup_library()
    support.use_claude("Entropy rises [0:10].")
    ask = lambda workspace: api.post("/api/chat/query", json={  # noqa: E731
        "question": "what is entropy", "scope": "workspace", "workspace_id": workspace,
    }).json()

    first = ask(physics)
    assert first["cache_hit"] is False
    assert ask(physics)["cache_hit"] is True, "same question, same subject: from cache"

    # Leave Biology holding only the lecture Physics was answered from.
    api.put(f"/api/videos/{cells}/workspace", json={"workspace_id": None})
    api.put(f"/api/videos/{thermo}/workspace", json={"workspace_id": biology})
    moved = ask(biology)

    assert [s["chunk_id"] for s in moved["sources"]] == [s["chunk_id"] for s in first["sources"]]
    assert moved["cache_hit"] is False

    db = support.session()
    try:
        assert db.query(AnswerCache).count() == 2
    finally:
        db.close()


def test_video_scope_needs_a_video():
    api, *_ = setup_library()
    assert api.post("/api/chat/query", json={"question": "q", "scope": "video"}).status_code == 400


if __name__ == "__main__":
    support.run(globals())
