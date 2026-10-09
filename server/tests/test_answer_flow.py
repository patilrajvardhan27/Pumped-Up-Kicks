"""
The real stream_answer, with retrieval and Claude replaced by stand-ins.
No API call, no database. Run from server/ with: python -m tests.test_answer_flow
"""
import api.services.lecture_rag_service as rag_module
from api.services.coverage import MESSAGE
from api.services.lecture_rag_service import LectureRAGService

SOURCE = {
    "chunk_id": 1, "video_id": 1, "text": "recurrence saves information", "start": 479.0, "end": 559.0,
    "timestamp": "7:59 - 9:19", "video": "Lecture", "video_filename": "l.mp4", "video_duration": 600.0, "similarity": 0.37,
}
USAGE = {"input_tokens": 100, "output_tokens": 5, "cache_read_tokens": 0, "cache_write_tokens": 0, "model": "m", "cost_usd": 0.001}


class FakeClaude:
    def __init__(self, pieces):
        self.pieces = pieces

    def stream(self, system, user):
        for piece in self.pieces:
            yield {"type": "delta", "text": piece}
        yield {"type": "done", "text": "".join(self.pieces).strip(), "usage": USAGE}


def run(pieces, sources=(SOURCE,)):
    service = LectureRAGService()
    service.retrieve = lambda *a, **k: list(sources)
    rag_module.get_claude_client = lambda: FakeClaude(pieces)
    events = list(service.stream_answer(db=None, user_id="u", question="q"))
    deltas = "".join(e["text"] for e in events if e["type"] == "delta")
    done = next(e for e in events if e["type"] == "done")
    return events, deltas, done


def test_off_topic_question_shows_one_line_and_nothing_else():
    events, deltas, done = run(["NOT", "_COVERED"])
    assert deltas == "", "the marker must never reach the client"
    assert done["answer"] == MESSAGE
    assert done["sources"] == [] and done["num_sources"] == 0, "no excerpts, nothing to cite or click"
    assert done.get("not_covered") is True
    assert done["usage"]["cost_usd"] == 0.001, "the call still cost something, so the cost is still reported"


def test_model_that_explains_after_the_marker_is_cut_off():
    _, deltas, done = run(["NOT_COVERED", ". The excerpts are about recurrent networks [6:47]."])
    assert deltas == "" and done["answer"] == MESSAGE and done["sources"] == []


def test_on_topic_question_streams_and_keeps_its_citations():
    _, deltas, done = run(["Recurrence is for ", "saving information [7:59]."])
    assert deltas == "Recurrence is for saving information [7:59]."
    assert done["answer"] == "Recurrence is for saving information [7:59]."
    assert done["sources"] == [SOURCE] and "not_covered" not in done


def test_partial_answer_that_starts_with_not_is_kept():
    _, deltas, done = run(["Not all examples were ", "worked through [3:00]."])
    assert done["answer"].startswith("Not all examples") and done["sources"] == [SOURCE]


def test_no_indexed_lectures_is_unchanged():
    events, _, done = run(["unused"], sources=())
    assert "Nothing is indexed here yet" in done["answer"] and done["sources"] == []


def test_cache_key_changes_with_prompt_version():
    from api.services import coverage
    original = LectureRAGService.cache_key("q", [SOURCE], "m")
    coverage.PROMPT_VERSION, saved = "next", coverage.PROMPT_VERSION
    rag_module.PROMPT_VERSION = "next"
    try:
        assert LectureRAGService.cache_key("q", [SOURCE], "m") != original
    finally:
        coverage.PROMPT_VERSION = saved
        rag_module.PROMPT_VERSION = saved


if __name__ == "__main__":
    tests = [t for name, t in sorted(globals().items()) if name.startswith("test_")]
    for t in tests:
        t()
    print(f"{len(tests)} checks passed")
