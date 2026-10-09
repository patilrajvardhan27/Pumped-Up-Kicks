"""
Study tools: study guides, practice questions and flashcards, deadlines, and
subject-wide answers drawing on lectures and documents together. Claude is a
stand-in that returns fixed JSON. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_study
"""
import json
from datetime import datetime, timedelta, timezone

from api.models.database import Deadline, StudyGuide, UsageCharge
from api.services import study
from api.services.lecture_rag_service import LectureRAGService
from api.services.scope import ChatScope
from tests import support

TRANSCRIPT = [
    "today we cover the first law of thermodynamics",
    "internal energy changes by heat added minus work done",
    "an adiabatic process exchanges no heat with its surroundings",
    "so for an adiabatic process the work comes from internal energy",
]

GUIDE = {
    "summary": "The lecture introduces the first law and applies it to adiabatic processes.",
    "key_terms": [
        {"term": "Adiabatic", "definition": "No heat exchanged with the surroundings.", "timestamp": "1:05"},
        {"term": "Internal energy", "definition": "Energy stored in the system.", "timestamp": "59:59"},
        {"term": "", "definition": "blank terms are dropped", "timestamp": "0:10"},
    ],
    "outline": [
        {"timestamp": "1:00", "title": "Adiabatic processes"},
        {"timestamp": "0:00", "title": "The first law"},
        {"timestamp": "0:00", "title": "Duplicate start"},
        {"timestamp": "3:30", "title": "Past the end of the lecture"},
        {"timestamp": "soon", "title": "Not a time"},
    ],
}


def lecture(user="alice", workspace_id=None):
    return support.add_video(user, "Thermo 1", TRANSCRIPT, workspace_id)


def charges(user="alice"):
    db = support.session()
    try:
        return db.query(UsageCharge).filter(UsageCharge.user_id == user).all()
    finally:
        db.close()


# --- study guides -----------------------------------------------------------------


def test_study_guide_is_made_once_and_its_timestamps_are_checked():
    support.fresh()
    api = support.client("alice")
    video = lecture()
    assert api.get(f"/api/videos/{video}/study-guide").json() == {"guide": None}

    claude = support.use_claude(json.dumps(GUIDE))
    made = api.post(f"/api/videos/{video}/study-guide")
    assert made.status_code == 200, made.text
    guide = made.json()["guide"]

    assert guide["summary"].startswith("The lecture introduces")
    assert [e["title"] for e in guide["outline"]] == ["The first law", "Adiabatic processes"], (
        "sorted, with out-of-range, duplicate and malformed times dropped"
    )
    terms = {t["term"]: t["start"] for t in guide["key_terms"]}
    assert terms == {"Adiabatic": 65.0, "Internal energy": None}, "a time outside the lecture is not a link"

    assert "<transcript>" in claude.prompts[0] and "[0:30] internal energy changes" in claude.prompts[0]

    again = api.post(f"/api/videos/{video}/study-guide").json()["guide"]
    assert again == guide and len(claude.prompts) == 1, "stored, not generated twice"
    assert len(charges()) == 1
    assert api.get(f"/api/videos/{video}/study-guide").json()["guide"] == guide


def test_study_guide_cost_counts_against_the_monthly_quota():
    support.fresh()
    api = support.client("alice")
    video = lecture()
    support.use_claude(json.dumps(GUIDE))
    api.post(f"/api/videos/{video}/study-guide")
    assert api.get("/api/chat/usage").json()["quota"]["spent_usd"] == support.FakeClaude.USAGE["cost_usd"]

    saved = support.settings.free_plan_monthly_usd
    support.settings.free_plan_monthly_usd = 0.0
    try:
        other = support.add_video("alice", "Thermo 2", TRANSCRIPT)
        assert api.post(f"/api/videos/{other}/study-guide").status_code == 402
    finally:
        support.settings.free_plan_monthly_usd = saved


def test_unusable_reply_is_charged_but_not_stored():
    support.fresh()
    api = support.client("alice")
    video = lecture()
    support.use_claude("Sorry, here is a guide: summary first...")
    failed = api.post(f"/api/videos/{video}/study-guide")
    assert failed.status_code == 502
    assert len(charges()) == 1, "the call cost money even though nothing came of it"
    db = support.session()
    try:
        assert db.query(StudyGuide).count() == 0
    finally:
        db.close()

    support.use_claude(json.dumps(GUIDE))
    assert api.post(f"/api/videos/{video}/study-guide").status_code == 200


def test_unprocessed_lecture_has_no_guide_yet():
    support.fresh()
    api = support.client("alice")
    video = lecture()
    db = support.session()
    try:
        from api.models.database import Video
        db.get(Video, video).stage = "transcribing"
        db.commit()
    finally:
        db.close()
    assert api.post(f"/api/videos/{video}/study-guide").status_code == 409


def test_overlap_between_chunks_is_read_once():
    support.fresh()
    video = support.add_video("alice", "Overlap", [
        "one two three four five",
        "four five six seven",
        "six seven eight",
    ])
    db = support.session()
    try:
        from api.models.database import Video
        lines = study.lecture_lines(db, db.get(Video, video))
    finally:
        db.close()
    assert [text for _, _, text in lines] == ["one two three four five", "six seven", "eight"]


def test_long_lecture_is_cut_and_says_where():
    support.fresh()
    api = support.client("alice")
    video = lecture()
    saved = study.GUIDE_MAX_CHARS
    study.GUIDE_MAX_CHARS = 120
    try:
        claude = support.use_claude(json.dumps(GUIDE))
        guide = api.post(f"/api/videos/{video}/study-guide").json()["guide"]
    finally:
        study.GUIDE_MAX_CHARS = saved
    assert guide["covered_until_s"] == 60.0
    assert "cut at 1:00" in claude.prompts[0]
    assert [e["title"] for e in guide["outline"]] == ["The first law"], "1:00 onwards was not sent"
    assert {t["term"]: t["start"] for t in guide["key_terms"]}["Adiabatic"] is None, (
        "1:05 was not sent, so it can't be cited"
    )


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
