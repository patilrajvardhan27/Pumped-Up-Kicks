"""Run with: python -m evals.test_quality"""
from evals.quality import normalise, run_checks


def seg(start, end, text="the gradient is close to zero in every direction here"):
    return {"start": float(start), "end": float(end), "text": text}


def lecture(n=40, step=10, text=None):
    return [seg(i * step, i * step + step, text or f"point number {i} about topic {i} in the course") for i in range(n)]


def kinds(report):
    return {f.check for f in report["findings"]}


def test_clean_transcript_is_ok():
    report = run_checks(lecture(), duration=400)
    assert report["verdict"] == "ok" and not report["findings"], report


def test_identical_run_is_flagged():
    segs = lecture()
    for i in (10, 11, 12):
        segs[i]["text"] = "Thank you."
    report = run_checks(segs, duration=400)
    assert "repeat" in kinds(report) and report["stats"]["flagged_segments"] == 3


def test_gap_is_flagged():
    segs = lecture()
    for s in segs[20:]:
        s["start"] += 60
        s["end"] += 60
    assert "gap" in kinds(run_checks(segs, duration=460))


def test_short_coverage_warns_and_very_short_fails():
    assert run_checks(lecture(30), duration=400)["verdict"] == "warn"
    assert run_checks(lecture(10), duration=400)["verdict"] == "fail"


def test_backwards_timestamps_fail():
    segs = lecture()
    segs[5]["start"], segs[5]["end"] = 90.0, 50.0
    assert run_checks(segs, duration=400)["verdict"] == "fail"


def test_invented_phrase_and_sparse_segment():
    segs = lecture()
    segs[3]["text"] = "Thanks for watching and please subscribe"
    segs[7] = seg(70, 130, "um")
    found = kinds(run_checks(segs, duration=400))
    assert {"invented-phrase", "sparse"} <= found


def test_repetitive_text_inside_one_segment():
    segs = lecture()
    segs[4]["text"] = "and then " * 30
    assert "repeat" in kinds(run_checks(segs, duration=400))


def test_many_flagged_segments_fail_the_lecture():
    segs = lecture()
    for i in range(0, 8):
        segs[i]["text"] = "Thanks for watching"
    assert run_checks(segs, duration=400)["verdict"] == "fail"


def test_empty_transcript_fails():
    assert run_checks([], duration=100)["verdict"] == "fail"


def test_normalise():
    assert normalise("  Thank   you!! ") == "thank you"


if __name__ == "__main__":
    tests = [t for name, t in sorted(globals().items()) if name.startswith("test_")]
    for t in tests:
        t()
    print(f"{len(tests)} checks passed")
