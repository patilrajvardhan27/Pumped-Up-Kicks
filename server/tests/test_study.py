"""
Study tools: study guides, practice questions and flashcards, deadlines, and
subject-wide answers drawing on lectures and documents together. Claude is a
stand-in that returns fixed JSON. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_study
"""
import json

from api.models.database import StudyGuide, UsageCharge
from api.services import study
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


if __name__ == "__main__":
    support.run(globals())
