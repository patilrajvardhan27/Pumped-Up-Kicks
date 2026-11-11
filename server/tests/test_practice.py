"""
Practice questions and flashcards, upcoming deadlines, and subject-wide answers
drawing on lectures and documents together. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_practice
"""
import json
from datetime import datetime, timedelta, timezone

from api.models.database import Deadline
from api.services.lecture_rag_service import LectureRAGService
from api.services.scope import ChatScope
from tests import support
from tests.test_study import charges, lecture

# --- practice -----------------------------------------------------------------------


def subject_with_material(api):
    physics = api.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    lecture(workspace_id=physics)
    support.add_document("alice", "Notes.pdf", [
        "The Carnot efficiency depends only on the reservoir temperatures.",
        "Entropy of an isolated system never decreases.",
    ], physics)
    support.add_video("alice", "Elsewhere", ["a lecture in no subject about cooking"])
    return physics


def test_practice_items_must_cite_an_excerpt_they_were_given():
    support.fresh()
    api = support.client("alice")
    physics = subject_with_material(api)
    reply = {"items": [
        {"question": "What does Carnot efficiency depend on?", "answer": "Only the reservoir temperatures.", "source": "E1"},
        {"question": "What is an adiabatic process?", "answer": "One with no heat exchange.", "source": "E2"},
        {"question": "Invented", "answer": "Not from any excerpt.", "source": "E99"},
        {"question": "No source", "answer": "Dropped."},
        {"question": "What is an adiabatic process?", "answer": "Duplicate question.", "source": "E3"},
    ]}
    claude = support.use_claude(json.dumps(reply))
    made = api.post(f"/api/workspaces/{physics}/practice", json={"kind": "questions", "count": 5})
    assert made.status_code == 201, made.text
    items = made.json()["items"]

    assert len(items) == 2
    prompt = claude.prompts[0]
    assert "cooking" not in prompt, "only this subject's material is sent"
    for item in items:
        source = item["source"]
        assert source["kind"] in ("video", "document") and "text" not in source
        if source["kind"] == "video":
            assert source["video_id"] and source["timestamp"]
        else:
            assert source["url"].startswith("https://") and source["page"] in (1, 2)
    assert len(charges()) == 1

    listed = api.get(f"/api/workspaces/{physics}/practice").json()
    assert [s["id"] for s in listed] == [made.json()["id"]]
    assert api.delete(f"/api/practice/{made.json()['id']}").status_code == 200
    assert api.get(f"/api/workspaces/{physics}/practice").json() == []


def test_flashcards_with_a_focus():
    support.fresh()
    api = support.client("alice")
    physics = subject_with_material(api)
    claude = support.use_claude(json.dumps({"items": [
        {"front": "Entropy of an isolated system", "back": "Never decreases.", "source": "E1"},
    ]}))
    made = api.post(f"/api/workspaces/{physics}/practice", json={
        "kind": "flashcards", "count": 3, "focus": "entropy isolated system",
    }).json()
    assert made["kind"] == "flashcards" and made["focus"] == "entropy isolated system"
    assert made["items"][0]["front"] == "Entropy of an isolated system"
    assert prompt_starts_with(claude.prompts[0], "Entropy of an isolated system never decreases.")


def prompt_starts_with(prompt: str, text: str) -> bool:
    """The first excerpt (E1) is the nearest passage to the focus."""
    return prompt.split("\n")[2] == text


def test_practice_needs_material_and_respects_limits():
    support.fresh()
    api = support.client("alice")
    empty = api.post("/api/workspaces", json={"name": "Empty"}).json()["id"]
    support.use_claude("{}")
    nothing = api.post(f"/api/workspaces/{empty}/practice", json={"kind": "questions"})
    assert nothing.status_code == 409 and charges() == [], "no call, no charge"
    assert api.post(f"/api/workspaces/{empty}/practice", json={"kind": "essay"}).status_code == 422
    assert api.post(f"/api/workspaces/{empty}/practice", json={"kind": "questions", "count": 50}).status_code == 422


# --- deadlines ----------------------------------------------------------------------


def test_upcoming_deadlines_soonest_first():
    support.fresh()
    api = support.client("alice")
    physics = api.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    maths = api.post("/api/workspaces", json={"name": "Maths"}).json()["id"]
    now = datetime.now(timezone.utc)
    db = support.session()
    try:
        for i, (title, workspace, delta) in enumerate([
            ("Past", physics, -1), ("Next week", physics, 7), ("Tomorrow", maths, 1),
            ("Far away", physics, 200), ("Quiz 2", physics, 3),
        ]):
            db.add(Deadline(
                user_id="alice", workspace_id=workspace, canvas_course_id=1, canvas_assignment_id=i,
                title=title, due_at=now + timedelta(days=delta), is_quiz=title.startswith("Quiz"),
            ))
        db.commit()
    finally:
        db.close()

    assert [d["title"] for d in api.get("/api/deadlines").json()] == ["Tomorrow", "Quiz 2", "Next week"]
    physics_only = api.get(f"/api/deadlines?workspace_id={physics}").json()
    assert [d["title"] for d in physics_only] == ["Quiz 2", "Next week"]
    assert physics_only[0]["is_quiz"] is True


# --- subject-wide answers -----------------------------------------------------------


def test_subject_answers_draw_on_lectures_and_documents():
    support.fresh()
    api = support.client("alice")
    physics = api.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    support.add_document("alice", "Slides.pdf", [
        f"entropy entropy entropy increases slide {i}" for i in range(10)
    ], physics)
    support.add_video("alice", "Lecture", ["we saw that entropy increases in the lab"], physics)

    db = support.session()
    try:
        sources = LectureRAGService().retrieve(
            db, "alice", "entropy increases", scope=ChatScope("workspace", workspace_id=physics), top_k=5,
        )
    finally:
        db.close()
    assert {s["kind"] for s in sources} == {"video", "document"}, "the lecture keeps a place"
    assert len(sources) == 5
    similarities = [s["similarity"] for s in sources]
    assert similarities == sorted(similarities, reverse=True)
    refs = [s.get("ref") for s in sources if s["kind"] == "document"]
    assert refs == [f"Doc {i + 1}" for i, s in enumerate(sources) if s["kind"] == "document"]


if __name__ == "__main__":
    support.run(globals())
