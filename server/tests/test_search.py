"""
Full-text search across transcripts and course documents. Needs Postgres (see
tests/support.py).

Run from server/ with: python -m tests.test_search
"""
from sqlalchemy import text

from tests import support


def library():
    support.fresh()
    api = support.client("alice")
    physics = api.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    biology = api.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    support.add_video("alice", "Thermo", [
        "the Carnot engine is the most efficient heat engine",
        "real engines lose heat to friction",
    ], physics)
    support.add_document("alice", "Week 2 slides.pptx", [
        "Carnot efficiency equals one minus the cold over hot temperature",
    ], physics, mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation")
    support.add_video("alice", "Cells", ["mitochondria are the engine of the cell"], biology)
    support.add_video("alice", "Loose", ["a stray note about the Carnot cycle"])
    return api, physics, biology


def test_finds_transcripts_and_documents_in_one_subject():
    api, physics, _ = library()
    hits = api.get("/api/search", params={"q": "carnot", "workspace_id": physics}).json()

    assert {(h["kind"], h["title"]) for h in hits} == {("video", "Thermo"), ("document", "Week 2 slides.pptx")}
    video = next(h for h in hits if h["kind"] == "video")
    assert video["start"] == 0.0 and video["timestamp"] == "0:00" and video["video_id"]
    slide = next(h for h in hits if h["kind"] == "document")
    assert slide["page"] == 1 and slide["page_label"] == "slide 1" and slide["url"].startswith("https://")
    assert all("⟦" in h["snippet"] and "⟧" in h["snippet"] for h in hits), "matches are marked"
    assert "<b>" not in "".join(h["snippet"] for h in hits)


def test_scope_unsorted_and_everything():
    api, _, biology = library()
    assert [h["title"] for h in api.get("/api/search", params={"q": "carnot", "unsorted": "true"}).json()] == ["Loose"]
    assert {h["title"] for h in api.get("/api/search", params={"q": "carnot"}).json()} == {
        "Thermo", "Week 2 slides.pptx", "Loose",
    }
    assert [h["title"] for h in api.get("/api/search", params={"q": "engine", "workspace_id": biology}).json()] == ["Cells"]


def test_search_syntax_never_errors():
    api, physics, _ = library()
    for q in ('"heat engine"', "carnot -cycle", "engine or mitochondria", "'); drop table chunks; --", "the of", "??"):
        response = api.get("/api/search", params={"q": q, "workspace_id": physics})
        assert response.status_code == 200, (q, response.text)
    phrase = api.get("/api/search", params={"q": '"heat engine"', "workspace_id": physics}).json()
    assert [h["title"] for h in phrase] == ["Thermo"]
    assert api.get("/api/search", params={"q": "x"}).status_code == 422


def test_a_few_hits_per_source():
    support.fresh()
    api = support.client("alice")
    support.add_video("alice", "Repetitive", [f"entropy entropy point {i}" for i in range(10)])
    hits = api.get("/api/search", params={"q": "entropy"}).json()
    assert len(hits) == 3


def test_queries_use_the_index():
    library()
    db = support.session()
    try:
        db.execute(text("set local enable_seqscan = off"))
        plan = "\n".join(db.execute(text(
            "explain select id from chunks "
            "where to_tsvector('english', text) @@ websearch_to_tsquery('english', 'carnot')"
        )).scalars())
    finally:
        db.close()
    assert "ix_chunks_text_search" in plan, plan


if __name__ == "__main__":
    support.run(globals())
