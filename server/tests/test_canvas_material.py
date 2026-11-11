"""
Canvas sync, continued: throttling, plan limits, linking rules, answers that cite
documents, disconnecting, and the documents list. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_canvas_material
"""
import json

from api.models.database import CanvasConnection, Chunk, Deadline, Document, Workspace
from tests import support
from tests.fake_canvas import TOKEN
from tests.test_canvas_sync import connect, documents, sync


def test_sync_survives_throttling():
    api, fake, _ = connect()
    fake.throttle_next = 3
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    assert fake.sleeps[:3] == [1.0, 2.0, 4.0]
    assert len(documents()) == 9


def test_imports_stop_at_the_plan_limit():
    api, _, _ = connect()
    saved = support.settings.free_plan_max_chunks
    support.settings.free_plan_max_chunks = 4
    try:
        summary = sync(api, link=[{"course_id": 101, "workspace_id": None}])["summary"]
    finally:
        support.settings.free_plan_max_chunks = saved

    db = support.session()
    try:
        assert db.query(Chunk).filter(Chunk.user_id == "alice").count() <= 4
    finally:
        db.close()
    assert any("over your plan's limit" in note for note in summary["skipped"])
    usage = api.get("/api/chat/usage").json()["content"]
    assert usage["used_chunks"] <= 4


def test_only_enrolled_courses_can_be_linked_and_one_sync_at_a_time():
    api, _, _ = connect()
    assert api.post("/api/canvas/sync", json={"link": [{"course_id": 999}]}).status_code == 404
    assert api.post("/api/canvas/sync", json={"link": [{"course_id": 303}]}).status_code == 404

    db = support.session()
    try:
        connection = db.query(CanvasConnection).one()
        connection.sync_stage = "syncing"
        db.commit()
    finally:
        db.close()
    assert api.post("/api/canvas/sync", json={}).status_code == 409


def test_failed_sign_in_is_reported_not_raised():
    api, fake, _ = connect()
    fake.valid_tokens = set()
    api.post("/api/canvas/sync", json={})
    sync_state = api.get("/api/canvas/connection").json()["sync"]
    assert sync_state["stage"] == "failed" and sync_state["error"]
    assert TOKEN not in json.dumps(sync_state)


def test_answers_cite_course_documents_and_lectures_together():
    api, _, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    subject = api.get("/api/workspaces").json()[0]["id"]
    support.add_video("alice", "Lecture 3", ["entropy of an isolated system never decreases"], subject)
    support.add_video("alice", "Elsewhere", ["entropy of an isolated system never decreases"])
    claude = support.use_claude("It never decreases [0:00] [Doc 1].")

    answer = api.post("/api/chat/query", json={
        "question": "entropy of an isolated system", "scope": "workspace", "workspace_id": subject, "top_k": 8,
    }).json()
    kinds = {s["kind"] for s in answer["sources"]}
    assert kinds == {"video", "document"}
    assert "Elsewhere" not in {s["video"] for s in answer["sources"]}, "other subjects stay out"

    docs = [s for s in answer["sources"] if s["kind"] == "document"]
    assert all(s["ref"] == f"Doc {answer['sources'].index(s) + 1}" for s in docs)
    slide = next(s for s in docs if s["document_title"] == "Entropy slides.pptx")
    assert slide["page"] in (1, 2) and slide["timestamp"].startswith("slide ")
    assert slide["url"] == "https://canvas.test.edu/courses/101/files/9002"
    assert "[Doc " in claude.prompts[0] and "Entropy slides.pptx, slide" in claude.prompts[0]

    stored = api.get(f"/api/chat/conversations/{answer['conversation_id']}").json()
    restored = stored["messages"][1]["sources"]
    assert [s["ref"] for s in restored] == [s["ref"] for s in answer["sources"]]
    assert [s["chunk_id"] for s in restored] == [s["chunk_id"] for s in answer["sources"]]


def test_disconnect_can_keep_or_delete_imported_material():
    api, _, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    assert api.delete("/api/canvas/connection").status_code == 200
    assert len(documents()) == 9, "kept by default"
    assert api.get("/api/workspaces").json()[0]["canvas_course_id"] is None

    api, _, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    assert api.delete("/api/canvas/connection?delete_material=true").status_code == 200
    db = support.session()
    try:
        assert db.query(Document).count() == 0
        assert db.query(Deadline).count() == 0
        assert db.query(Chunk).filter(Chunk.document_id.is_not(None)).count() == 0
        assert db.query(Workspace).count() == 1, "the subject itself stays"
    finally:
        db.close()


def test_chunk_belongs_to_exactly_one_parent():
    from sqlalchemy.exc import IntegrityError

    api, _, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    video = support.add_video("alice", "Lecture", ["words"])
    document = next(iter(documents().values()))
    vector = support.HashingEmbedder().embed_one("x")

    for parents in ({"video_id": video, "document_id": document.id, "start_s": 0, "end_s": 1}, {}):
        db = support.session()
        try:
            db.add(Chunk(user_id="alice", text="x", embedding=vector, **parents))
            db.commit()
            raise AssertionError(f"accepted a chunk with parents {parents}")
        except IntegrityError:
            db.rollback()
        finally:
            db.close()


def test_documents_list_and_delete():
    api, _, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    subject = api.get("/api/workspaces").json()[0]["id"]
    listed = api.get(f"/api/documents?workspace_id={subject}").json()
    assert len(listed) == 9
    assert listed[0]["module_name"] == "Week 1: The first law"
    assert api.delete(f"/api/documents/{listed[0]['id']}").status_code == 200
    assert len(api.get(f"/api/documents?workspace_id={subject}").json()) == 8


if __name__ == "__main__":
    support.run(globals())
