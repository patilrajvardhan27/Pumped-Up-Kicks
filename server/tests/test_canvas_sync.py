"""
Importing a Canvas course into a subject, against recorded Canvas responses
(tests/fake_canvas.py). Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_canvas_sync
"""
import json

import httpx

from api.models.database import CanvasConnection, Chunk, Deadline, Document, Workspace
from tests import fake_canvas, support
from tests.fake_canvas import TOKEN


class CountingEmbedder(support.HashingEmbedder):
    def __init__(self):
        self.embedded = 0

    def embed_many(self, texts, batch_size: int = 64):
        texts = list(texts)
        self.embedded += len(texts)
        return super().embed_many(texts)


def connect(user="alice"):
    """A fresh database, a fake Canvas, and `user` connected to it with a personal token."""
    support.fresh()
    fake = fake_canvas.install()
    import services.embeddings.embedder as embedder_module

    counter = CountingEmbedder()
    embedder_module._embedder = counter
    api = support.client(user)
    support.settings.canvas_allow_personal_tokens = True
    try:
        response = api.post("/api/canvas/token", json={"base_url": "canvas.test.edu", "token": TOKEN})
        assert response.status_code == 200, response.text
    finally:
        support.settings.canvas_allow_personal_tokens = False
    return api, fake, counter


def sync(api, **body):
    response = api.post("/api/canvas/sync", json=body)
    assert response.status_code == 200, response.text
    # TestClient runs background tasks before returning, so the sync is done.
    status = api.get("/api/canvas/connection").json()
    assert status["sync"]["stage"] == "ready", status["sync"]
    return status["sync"]


def documents(user="alice"):
    db = support.session()
    try:
        return {(d.source, d.canvas_id): d for d in db.query(Document).filter(Document.user_id == user)}
    finally:
        db.close()


def test_courses_lists_active_student_courses_across_pages():
    api, fake, _ = connect()
    courses = api.get("/api/canvas/courses").json()
    assert [(c["id"], c["term"]) for c in courses] == [(101, "Fall 2026"), (202, "Fall 2026")]
    assert all(c["workspace_id"] is None for c in courses)
    query = fake.requests[-2].url.params
    assert query["enrollment_type"] == "student" and query["enrollment_state"] == "active"


def test_first_sync_imports_a_course_into_a_new_subject():
    api, fake, _ = connect()
    summary = sync(api, link=[{"course_id": 101, "workspace_id": None}])

    [subject] = api.get("/api/workspaces").json()
    assert subject["name"] == "PHYS 2210: Thermodynamics" and subject["canvas_course_id"] == 101

    docs = documents()
    assert set(docs) == {
        ("canvas_syllabus", 101),
        ("canvas_page", 3001), ("canvas_page", 3002),
        ("canvas_file", 9001), ("canvas_file", 9002), ("canvas_file", 9003),
        ("canvas_announcement", 4001),
        ("canvas_assignment", 8001), ("canvas_assignment", 8004),
    }
    assert all(d.workspace_id == subject["id"] for d in docs.values())

    pdf, deck, word = docs[("canvas_file", 9001)], docs[("canvas_file", 9002)], docs[("canvas_file", 9003)]
    assert pdf.num_pages == 2 and pdf.module_name == "Week 1: The first law"
    assert deck.module_name == "Week 2: Entropy", "module items reached through items_url"
    assert pdf.url == "https://canvas.test.edu/courses/101/files/9001"
    assert word.num_pages is None

    db = support.session()
    try:
        pages = sorted(c.page for c in db.query(Chunk).filter(Chunk.document_id == pdf.id))
        assert pages == [1, 2]
        syllabus = db.query(Chunk).filter(Chunk.document_id == docs[("canvas_syllabus", 101)].id).one()
        assert "alert" not in syllabus.text and "laws of thermodynamics" in syllabus.text
        deadlines = {d.canvas_assignment_id: d for d in db.query(Deadline)}
    finally:
        db.close()

    assert set(deadlines) == {8001, 8002, 8003}, "every assignment with a due date, quizzes included"
    assert deadlines[8002].is_quiz and deadlines[8003].is_quiz and not deadlines[8001].is_quiz

    assert summary["summary"]["added"] == 9
    skipped = " ".join(summary["summary"]["skipped"])
    assert "Full textbook scan.pdf" in skipped


def test_never_imports_quiz_content_submissions_grades_or_locked_material():
    api, fake, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    docs = documents()

    assert ("canvas_assignment", 8002) not in docs and ("canvas_assignment", 8003) not in docs
    assert ("canvas_file", 9005) not in docs, "a file locked for the student"
    assert ("canvas_page", 3003) not in docs, "a page locked for the student"
    assert ("canvas_file", 9004) not in docs, "not a supported format"

    db = support.session()
    try:
        everything = " ".join(c.text for c in db.query(Chunk))
    finally:
        db.close()
    assert "internal energy of an ideal gas" not in everything, "quiz question text"

    asked = " ".join(str(r.url) for r in fake.requests).lower()
    for forbidden in ("quizzes", "submission", "grade", "total_scores", "enrollments", "/users/4471", "students"):
        assert forbidden not in asked, f"asked Canvas for {forbidden}"
    assert all(r.method == "GET" for r in fake.requests if r.url.path != "/login/oauth2/token")


def test_link_course_to_an_existing_subject():
    api, _, _ = connect()
    physics = api.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    sync(api, link=[{"course_id": 101, "workspace_id": physics}])

    subjects = api.get("/api/workspaces").json()
    assert [(w["name"], w["canvas_course_id"]) for w in subjects] == [("Physics", 101)]
    assert {d.workspace_id for d in documents().values()} == {physics}


def test_relinking_moves_material_without_re_embedding():
    api, _, counter = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    embedded = counter.embedded
    maths = api.post("/api/workspaces", json={"name": "Somewhere else"}).json()["id"]

    sync(api, link=[{"course_id": 101, "workspace_id": maths}])
    assert {d.workspace_id for d in documents().values()} == {maths}
    assert counter.embedded == embedded


def test_second_sync_only_fetches_and_embeds_what_changed():
    api, fake, counter = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}])
    first_downloads, first_embedded = len(fake.downloads()), counter.embedded
    assert first_downloads == 3

    unchanged = sync(api)
    assert len(fake.downloads()) == first_downloads, "no file downloaded again"
    assert counter.embedded == first_embedded, "nothing embedded again"
    assert unchanged["summary"]["unchanged"] == 9 and unchanged["summary"]["added"] == 0

    # Canvas reports one page edited and one file gone.
    pages = fake.fixture("courses_101_pages")
    pages["pages"][0][0]["updated_at"] = "2026-09-30T16:00:00Z"
    fake.edits["courses_101_pages"] = pages
    edited = fake.fixture("courses_101_pages_week-1-overview")
    edited["body"] = "<p>Updated: the first law, with a worked example on a piston.</p>"
    fake.edits["courses_101_pages_week-1-overview"] = edited
    files = fake.fixture("courses_101_files")
    files["pages"][0] = [f for f in files["pages"][0] if f["id"] != 9003]
    fake.edits["courses_101_files"] = files

    changed = sync(api)["summary"]
    assert changed["updated"] == 1 and changed["removed"] == 1
    assert len(fake.downloads()) == first_downloads
    assert ("canvas_file", 9003) not in documents()
    db = support.session()
    try:
        page = documents()[("canvas_page", 3001)]
        assert "piston" in db.query(Chunk).filter(Chunk.document_id == page.id).first().text
    finally:
        db.close()


def test_hidden_tabs_are_noted_and_keep_earlier_imports():
    api, fake, _ = connect()
    sync(api, link=[{"course_id": 101, "workspace_id": None}, {"course_id": 202, "workspace_id": None}])
    before = documents()
    assert ("canvas_assignment", 8101) in before

    fake.overrides["/api/v1/courses/101/files"] = lambda r: httpx.Response(
        403, json={"status": "unauthorized", "errors": [{"message": "user not authorized to perform that action"}]}
    )
    summary = sync(api)["summary"]
    after = documents()
    assert {k for k in before if k[0] == "canvas_file"} == {k for k in after if k[0] == "canvas_file"}
    assert any("Files: not available" in note for note in summary["skipped"])
    # Course 202 has no pages or files fixtures, which Canvas would answer 404/403 for.
    assert any(note.startswith("MATH 3130") for note in summary["skipped"])


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
