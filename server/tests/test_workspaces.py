"""
Subject workspaces: create, rename, recolour, reorder, delete, and filing
lectures under them. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_workspaces
"""
import io
import tempfile
from pathlib import Path

from tests import support


def make(api, name, **extra):
    response = api.post("/api/workspaces", json={"name": name, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_lists_in_order_with_defaults():
    support.fresh()
    api = support.client("alice")

    physics = make(api, "Physics", color="purple", icon="atom")
    maths = make(api, "  Linear   Algebra ")

    assert physics["color"] == "purple" and physics["icon"] == "atom"
    assert maths["name"] == "Linear Algebra", "whitespace is collapsed"
    assert maths["color"] == "blue" and maths["icon"] == "book"
    assert maths["position"] == physics["position"] + 1

    listed = api.get("/api/workspaces").json()
    assert [w["name"] for w in listed] == ["Physics", "Linear Algebra"]
    assert all(w["video_count"] == 0 for w in listed)


def test_names_are_unique_per_user_only():
    support.fresh()
    alice, bob = support.client("alice"), support.client("bob")
    make(alice, "Physics")

    assert alice.post("/api/workspaces", json={"name": "Physics"}).status_code == 409
    assert bob.post("/api/workspaces", json={"name": "Physics"}).status_code == 201


def test_rejects_unknown_colours_icons_and_blank_names():
    support.fresh()
    api = support.client("alice")

    assert api.post("/api/workspaces", json={"name": "X", "color": "#ff0000"}).status_code == 422
    assert api.post("/api/workspaces", json={"name": "X", "icon": "skull"}).status_code == 422
    assert api.post("/api/workspaces", json={"name": "   "}).status_code == 422
    assert api.post("/api/workspaces", json={"name": "x" * 61}).status_code == 422


def test_rename_and_recolour():
    support.fresh()
    api = support.client("alice")
    physics = make(api, "Physics")
    make(api, "Chemistry")

    renamed = api.patch(f"/api/workspaces/{physics['id']}", json={"name": "Physics II", "color": "teal"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Physics II" and renamed.json()["color"] == "teal"
    assert renamed.json()["icon"] == "book", "fields left out stay as they were"

    taken = api.patch(f"/api/workspaces/{physics['id']}", json={"name": "Chemistry"})
    assert taken.status_code == 409


def test_reorder_needs_every_workspace_exactly_once():
    support.fresh()
    api = support.client("alice")
    a, b, c = (make(api, name)["id"] for name in ("A", "B", "C"))

    reordered = api.put("/api/workspaces/order", json={"workspace_ids": [c, a, b]})
    assert reordered.status_code == 200, reordered.text
    assert [w["name"] for w in reordered.json()] == ["C", "A", "B"]
    assert [w["name"] for w in api.get("/api/workspaces").json()] == ["C", "A", "B"]

    for bad in ([a, b], [a, b, c, c], [a, b, c, 999]):
        assert api.put("/api/workspaces/order", json={"workspace_ids": bad}).status_code == 400


def test_limit_on_number_of_workspaces():
    support.fresh()
    api = support.client("alice")
    saved = support.settings.max_workspaces_per_user
    support.settings.max_workspaces_per_user = 2
    try:
        make(api, "A")
        make(api, "B")
        assert api.post("/api/workspaces", json={"name": "C"}).status_code == 400
    finally:
        support.settings.max_workspaces_per_user = saved


def test_move_video_between_workspaces_and_to_unsorted():
    support.fresh()
    api = support.client("alice")
    physics, maths = make(api, "Physics")["id"], make(api, "Maths")["id"]
    video = support.add_video("alice", "Lecture 1", ["forces and motion"], workspace_id=physics)

    support.use_claude()
    chat = api.post("/api/chat/stream", json={"question": "forces?", "video_id": video})
    assert chat.status_code == 200

    moved = api.put(f"/api/videos/{video}/workspace", json={"workspace_id": maths})
    assert moved.status_code == 200, moved.text
    assert moved.json()["workspace_id"] == maths

    counts = {w["id"]: w["video_count"] for w in api.get("/api/workspaces").json()}
    assert counts == {physics: 0, maths: 1}

    threads = api.get(f"/api/chat/conversations?workspace_id={maths}").json()
    assert len(threads) == 1 and threads[0]["video_id"] == video, "a lecture's chats move with it"

    unsorted = api.put(f"/api/videos/{video}/workspace", json={"workspace_id": None})
    assert unsorted.json()["workspace_id"] is None
    assert api.get("/api/chat/conversations?unsorted=true").json()[0]["video_id"] == video


def test_deleting_a_workspace_moves_its_content_to_unsorted():
    support.fresh()
    api = support.client("alice")
    physics = make(api, "Physics")["id"]
    video = support.add_video("alice", "Lecture 1", ["forces and motion"], workspace_id=physics)

    support.use_claude()
    api.post("/api/chat/stream", json={"question": "forces?", "scope": "workspace", "workspace_id": physics})

    deleted = api.delete(f"/api/workspaces/{physics}")
    assert deleted.status_code == 200
    assert api.get("/api/workspaces").json() == []
    assert api.get(f"/api/videos/{video}").json()["workspace_id"] is None

    [thread] = api.get("/api/chat/conversations?unsorted=true").json()
    assert thread["scope"] == "workspace" and thread["workspace_id"] is None, (
        "the subject's chat now searches Unsorted, never the whole library"
    )


def test_uploads_land_in_the_requested_workspace():
    support.fresh()
    api = support.client("alice")
    physics = make(api, "Physics")["id"]

    with tempfile.TemporaryDirectory() as root:
        support.use_storage(Path(root))

        presigned = api.post(
            "/api/videos/presign",
            json={"filename": "week1.mp4", "file_size": 10, "workspace_id": physics},
        )
        assert presigned.status_code == 200, presigned.text
        reserved = api.get(f"/api/videos/{presigned.json()['video_id']}").json()
        assert reserved["workspace_id"] == physics

        uploaded = api.post(
            "/api/videos/upload",
            files={"file": ("week2.mp4", io.BytesIO(b"not really a video"), "video/mp4")},
            data={"workspace_id": str(physics)},
        )
        assert uploaded.status_code == 200, uploaded.text
        assert api.get(f"/api/videos/{uploaded.json()['video_id']}").json()["workspace_id"] == physics

        missing = api.post(
            "/api/videos/presign", json={"filename": "week3.mp4", "workspace_id": 999}
        )
        assert missing.status_code == 404


if __name__ == "__main__":
    support.run(globals())
