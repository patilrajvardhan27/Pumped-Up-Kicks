"""Study tool helpers: which passages an answer cites, and transcript rebuilding."""
from api.services.study import cited_sources, parse_clock, transcript_lines, tool_for


def passage(chunk_id, start, end):
    return {"chunk_id": chunk_id, "start": start, "end": end}


def test_parse_clock():
    assert parse_clock("12:04") == 724
    assert parse_clock("1:02:33") == 3753
    assert parse_clock("x") is None


def test_cited_sources_keeps_only_cited_passages():
    passages = [passage(1, 0, 75), passage(2, 57, 132), passage(3, 600, 675)]
    answer = "Intro [0:30]. Later point [10:05 - 10:30]."
    assert [p["chunk_id"] for p in cited_sources(answer, passages)] == [1, 3]


def test_uncited_answer_keeps_nothing():
    assert cited_sources("No timestamps here.", [passage(1, 0, 75)]) == []


def test_transcript_drops_the_overlap_between_chunks():
    chunks = [
        {"start": 0.0, "end": 75.0, "text": "one two three four five"},
        {"start": 57.0, "end": 132.0, "text": "four five six seven"},
        {"start": 114.0, "end": 190.0, "text": "seven eight"},
    ]
    lines = transcript_lines(chunks)
    assert " ".join(line["text"] for line in lines) == "one two three four five six seven eight"
    assert lines[1]["start"] == 75.0, "a trimmed line starts where the previous one ended"


def test_unknown_mode_is_a_plain_question():
    assert tool_for("ask") is None and tool_for("quiz") is not None
