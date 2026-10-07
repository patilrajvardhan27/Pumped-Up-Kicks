"""Run from server/ with: python -m tests.test_coverage"""
from api.services.coverage import MARKER, CoverageGate, is_not_covered


def run(deltas):
    """Feed a stream through the gate; return (text the client would see, flagged)."""
    gate = CoverageGate()
    shown = "".join(gate.feed(d) for d in deltas) + gate.finish()
    return shown, gate.not_covered


def test_marker_in_one_piece_is_swallowed():
    assert run([MARKER]) == ("", True)


def test_marker_split_across_tokens_is_swallowed():
    assert run(["NOT", "_COV", "ERED"]) == ("", True)


def test_marker_with_trailing_explanation_is_still_swallowed():
    assert run(["NOT_COVERED", ". The excerpts discuss recurrent networks", " instead."]) == ("", True)


def test_markdown_wrapped_marker():
    assert run(["**NOT", "_COVERED**"]) == ("", True)
    assert is_not_covered("`not_covered`")


def test_real_answer_streams_through_unchanged():
    deltas = ["Recurrence is ", "for saving ", "information [7:59]."]
    assert run(deltas) == ("Recurrence is for saving information [7:59].", False)


def test_answer_that_starts_like_the_marker_is_released():
    # "No" and "Not" are prefixes of the marker, so they are held, then released.
    assert run(["No", ", the lecturer says otherwise."]) == ("No, the lecturer says otherwise.", False)
    assert run(["Not ", "every example was worked through."]) == ("Not every example was worked through.", False)


def test_short_reply_that_ends_while_held_is_released():
    assert run(["No"]) == ("No", False)
    assert run(["N"]) == ("N", False)


def test_empty_stream():
    assert run([]) == ("", False)


def test_whitespace_before_marker():
    assert run(["\n", "NOT_COVERED"]) == ("", True)


def test_is_not_covered_does_not_fire_on_normal_text():
    assert not is_not_covered("The lecture covers recurrence.")
    assert not is_not_covered("Not covered in detail, but the lecturer mentions it [3:00].")
    assert is_not_covered("NOT_COVERED")


if __name__ == "__main__":
    tests = [t for name, t in sorted(globals().items()) if name.startswith("test_")]
    for t in tests:
        t()
    print(f"{len(tests)} checks passed")
