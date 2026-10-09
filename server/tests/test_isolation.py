"""
Tenant isolation: user A must not be able to read, change, use or even detect
user B's workspaces, the lectures and chats filed under them, B's imported
course documents, or B's Canvas connection. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_isolation
"""
from tests import support


def setup_two_users():
    support.fresh()
    alice, bob = support.client("alice"), support.client("bob")
    bobs = bob.post("/api/workspaces", json={"name": "Bob's physics", "color": "red"}).json()["id"]
    bob_video = support.add_video("bob", "Bob lecture", ["the secret of bob's lecture"], bobs)
    support.use_claude()
    bob_chat = bob.post("/api/chat/query", json={
        "question": "secret", "scope": "workspace", "workspace_id": bobs,
    }).json()["conversation_id"]
    alices = alice.post("/api/workspaces", json={"name": "Alice's maths"}).json()["id"]
    alice_video = support.add_video("alice", "Alice lecture", ["alice's own lecture"], alices)
    return alice, bob, bobs, bob_video, bob_chat, alices, alice_video


def test_workspace_list_is_per_user():
    alice, bob, bobs, *_ = setup_two_users()
    assert [w["name"] for w in alice.get("/api/workspaces").json()] == ["Alice's maths"]
    assert [w["name"] for w in bob.get("/api/workspaces").json()] == ["Bob's physics"]


def test_cannot_change_or_delete_anothers_workspace():
    alice, bob, bobs, *_ = setup_two_users()

    assert alice.patch(f"/api/workspaces/{bobs}", json={"name": "mine now"}).status_code == 404
    assert alice.delete(f"/api/workspaces/{bobs}").status_code == 404
    assert bob.get("/api/workspaces").json()[0]["name"] == "Bob's physics"


def test_reorder_cannot_include_anothers_workspace():
    alice, _, bobs, _, _, alices, _ = setup_two_users()
    response = alice.put("/api/workspaces/order", json={"workspace_ids": [bobs, alices]})
    assert response.status_code == 400


def test_cannot_file_into_anothers_workspace():
    alice, bob, bobs, bob_video, _, alices, alice_video = setup_two_users()

    assert alice.put(f"/api/videos/{alice_video}/workspace", json={"workspace_id": bobs}).status_code == 404
    assert alice.put(f"/api/videos/{bob_video}/workspace", json={"workspace_id": alices}).status_code == 404
    assert alice.post("/api/videos/presign", json={"filename": "x.mp4", "workspace_id": bobs}).status_code == 404
    assert bob.get("/api/workspaces").json()[0]["video_count"] == 1


def test_cannot_chat_inside_anothers_workspace_or_read_its_chats():
    alice, _, bobs, bob_video, bob_chat, *_ = setup_two_users()
    claude = support.use_claude()

    scoped = alice.post("/api/chat/query", json={
        "question": "secret", "scope": "workspace", "workspace_id": bobs,
    })
    assert scoped.status_code == 404
    assert alice.post("/api/chat/query", json={"question": "secret", "video_id": bob_video}).status_code == 404
    assert alice.post("/api/chat/query", json={"question": "secret", "conversation_id": bob_chat}).status_code == 404
    assert claude.prompts == [], "nothing of Bob's reached the model"

    assert alice.get(f"/api/chat/conversations?workspace_id={bobs}").json() == []
    assert alice.get(f"/api/chat/conversations/{bob_chat}").status_code == 404


def test_searching_everything_never_reaches_another_user():
    alice, *_ = setup_two_users()
    claude = support.use_claude()

    answer = alice.post("/api/chat/query", json={"question": "secret of bob's lecture"}).json()
    assert {s["video"] for s in answer["sources"]} == {"Alice lecture"}
    assert "secret" not in claude.prompts[0].split("Student's question")[0]


def setup_bob_with_canvas():
    """Bob has imported a Canvas course; Alice has a subject of her own and nothing else."""
    from tests import fake_canvas

    support.fresh()
    fake_canvas.install()
    alice, bob = support.client("alice"), support.client("bob")
    support.settings.canvas_allow_personal_tokens = True
    try:
        assert bob.post("/api/canvas/token", json={
            "base_url": "canvas.test.edu", "token": fake_canvas.TOKEN,
        }).status_code == 200
    finally:
        support.settings.canvas_allow_personal_tokens = False
    assert bob.post("/api/canvas/sync", json={"link": [{"course_id": 101}]}).status_code == 200
    bobs = bob.get("/api/workspaces").json()[0]["id"]
    alices = alice.post("/api/workspaces", json={"name": "Alice's maths"}).json()["id"]
    return alice, bob, bobs, alices


def test_documents_are_per_user():
    alice, bob, bobs, _ = setup_bob_with_canvas()
    bobs_documents = bob.get("/api/documents").json()
    assert len(bobs_documents) == 9

    assert alice.get("/api/documents").json() == []
    assert alice.get(f"/api/documents?workspace_id={bobs}").json() == []
    assert alice.delete(f"/api/documents/{bobs_documents[0]['id']}").status_code == 404
    assert len(bob.get("/api/documents").json()) == 9


def test_search_never_reaches_anothers_documents():
    alice, bob, bobs, alices = setup_bob_with_canvas()
    support.add_video("alice", "Alice lecture", ["the carnot cycle and reservoir temperatures"], alices)
    claude = support.use_claude()

    everything = alice.post("/api/chat/query", json={"question": "carnot engine efficiency reservoir"}).json()
    assert {s["kind"] for s in everything["sources"]} == {"video"}
    assert "Carnot engine depends only" not in claude.prompts[0]

    in_bobs = alice.post("/api/chat/query", json={
        "question": "carnot", "scope": "workspace", "workspace_id": bobs,
    })
    assert in_bobs.status_code == 404


def test_canvas_connection_and_links_are_per_user():
    alice, bob, bobs, alices = setup_bob_with_canvas()

    mine = alice.get("/api/canvas/connection").json()
    assert mine["connected"] is False and mine.get("sync") is None
    assert alice.get("/api/canvas/courses").status_code == 404
    assert alice.post("/api/canvas/sync", json={}).status_code == 404
    assert alice.delete("/api/canvas/connection").status_code == 404
    assert bob.get("/api/canvas/connection").json()["connected"] is True

    # Bob cannot link his course into Alice's subject either.
    linked = bob.post("/api/canvas/sync", json={"link": [{"course_id": 101, "workspace_id": alices}]})
    assert linked.status_code == 404
    assert alice.get("/api/workspaces").json()[0]["canvas_course_id"] is None


def test_usage_counts_only_ones_own_material():
    alice, bob, *_ = setup_bob_with_canvas()
    assert alice.get("/api/chat/usage").json()["content"]["used_chunks"] == 0
    assert bob.get("/api/chat/usage").json()["content"]["used_chunks"] > 0


def test_study_tools_deadlines_and_search_are_per_user():
    import json
    from datetime import datetime, timedelta, timezone

    from api.models.database import Deadline

    alice, bob, bobs, alices = setup_bob_with_canvas()
    bob_video = support.add_video("bob", "Bob lecture", ["bob's private lecture on heat engines"], bobs)
    guide = {"summary": "Bob's guide.", "key_terms": [], "outline": [{"timestamp": "0:00", "title": "Start"}]}
    claude = support.use_claude(json.dumps(guide))
    assert bob.post(f"/api/videos/{bob_video}/study-guide").status_code == 200

    assert alice.get(f"/api/videos/{bob_video}/study-guide").status_code == 404
    assert alice.post(f"/api/videos/{bob_video}/study-guide").status_code == 404

    support.use_claude(json.dumps({"items": [{"question": "Q", "answer": "A", "source": "E1"}]}))
    bobs_set = bob.post(f"/api/workspaces/{bobs}/practice", json={"kind": "questions"}).json()["id"]
    assert alice.get(f"/api/workspaces/{bobs}/practice").status_code == 404
    assert alice.post(f"/api/workspaces/{bobs}/practice", json={"kind": "questions"}).status_code == 404
    assert alice.delete(f"/api/practice/{bobs_set}").status_code == 404
    assert len(claude.prompts) == 1, "nothing of Bob's was sent on Alice's behalf"

    db = support.session()
    try:
        db.add(Deadline(
            user_id="bob", workspace_id=bobs, canvas_course_id=5, canvas_assignment_id=9,
            title="Bob's essay", due_at=datetime.now(timezone.utc) + timedelta(days=2), is_quiz=False,
        ))
        db.commit()
    finally:
        db.close()
    assert alice.get("/api/deadlines").json() == []
    assert alice.get(f"/api/deadlines?workspace_id={bobs}").json() == []
    assert "Bob's essay" in [d["title"] for d in bob.get("/api/deadlines").json()]

    for params in ({"q": "heat engines"}, {"q": "carnot", "workspace_id": bobs}):
        assert alice.get("/api/search", params=params).json() == []
    assert bob.get("/api/search", params={"q": "heat engines"}).json()


if __name__ == "__main__":
    support.run(globals())
