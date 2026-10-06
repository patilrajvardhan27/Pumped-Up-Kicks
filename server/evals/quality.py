"""
Checks on a transcript before any question is written from it.

A question set built on a bad transcript measures the transcript, not the
search. Everything here works on the timestamped segments alone, because that
is all the local transcriber keeps (no confidence scores). Each check returns
findings, so one bad stretch is visible without throwing the whole lecture away.
"""
import re
import zlib
from dataclasses import dataclass

# Thresholds. Named so a change is a one-line, reviewable decision.
MIN_COVERAGE = 0.90          # last segment should reach most of the recording
FAIL_COVERAGE = 0.50
MAX_GAP_S = 20.0             # silence or speech Whisper skipped
REPEAT_RUN = 3               # identical lines in a row: a hallucination loop
MAX_COMPRESSION_RATIO = 2.4  # Whisper's own cut-off for repetitive text
LONG_SEGMENT_S = 30.0        # a long segment with almost no words is suspect
MIN_WORDS_IN_LONG = 8
FAIL_FLAGGED_SHARE = 0.10    # more than this share of segments flagged fails the lecture

# What Whisper tends to invent over silence or music.
HALLUCINATION_PHRASES = (
    "thanks for watching",
    "thank you for watching",
    "please subscribe",
    "subtitles by",
    "amara.org",
    "like and subscribe",
    "see you in the next video",
)
NOISE_TAG = re.compile(r"^\s*[\[(][^\])]{1,30}[\])]\s*$")  # [Music], (applause)


@dataclass
class Finding:
    check: str
    severity: str  # "warn" or "fail"
    start: float
    end: float
    detail: str
    segment_indexes: tuple[int, ...] = ()


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", text.lower())).strip()


def clock(seconds: float) -> str:
    total = max(0, int(seconds))
    h, rest = divmod(total, 3600)
    m, s = divmod(rest, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def check_order(segments: list[dict]) -> list[Finding]:
    findings = []
    for i, seg in enumerate(segments):
        backwards = seg["end"] < seg["start"]
        out_of_order = i > 0 and seg["start"] < segments[i - 1]["start"]
        if backwards or out_of_order:
            findings.append(Finding("order", "fail", seg["start"], seg["end"],
                                    "timestamps go backwards", (i,)))
    return findings


def check_coverage(segments: list[dict], duration: float | None) -> list[Finding]:
    if not duration or not segments:
        return []
    reached = max(s["end"] for s in segments)
    share = reached / duration
    if share >= MIN_COVERAGE:
        return []
    severity = "fail" if share < FAIL_COVERAGE else "warn"
    return [Finding("coverage", severity, reached, duration,
                    f"transcript stops at {clock(reached)} of {clock(duration)} ({share:.0%})")]


def check_gaps(segments: list[dict]) -> list[Finding]:
    findings = []
    for i in range(1, len(segments)):
        gap = segments[i]["start"] - segments[i - 1]["end"]
        if gap > MAX_GAP_S:
            findings.append(Finding("gap", "warn", segments[i - 1]["end"], segments[i]["start"],
                                    f"{gap:.0f}s with no transcript", ()))
    return findings


def check_repeats(segments: list[dict]) -> list[Finding]:
    findings, i = [], 0
    while i < len(segments):
        key = normalise(segments[i]["text"])
        j = i
        while j + 1 < len(segments) and normalise(segments[j + 1]["text"]) == key:
            j += 1
        if key and j - i + 1 >= REPEAT_RUN:
            findings.append(Finding("repeat", "warn", segments[i]["start"], segments[j]["end"],
                                    f'{j - i + 1} identical lines: "{segments[i]["text"][:50]}"',
                                    tuple(range(i, j + 1))))
        i = j + 1
    for i, seg in enumerate(segments):
        raw = seg["text"].encode()
        if len(raw) >= 40 and len(raw) / len(zlib.compress(raw)) > MAX_COMPRESSION_RATIO:
            findings.append(Finding("repeat", "warn", seg["start"], seg["end"],
                                    "highly repetitive text inside one segment", (i,)))
    return findings


def check_sparse(segments: list[dict]) -> list[Finding]:
    return [
        Finding("sparse", "warn", s["start"], s["end"],
                f'{s["end"] - s["start"]:.0f}s segment with {len(s["text"].split())} words', (i,))
        for i, s in enumerate(segments)
        if s["end"] - s["start"] > LONG_SEGMENT_S and len(s["text"].split()) < MIN_WORDS_IN_LONG
    ]


def check_phrases(segments: list[dict]) -> list[Finding]:
    findings = []
    for i, seg in enumerate(segments):
        text = seg["text"].lower()
        hit = next((p for p in HALLUCINATION_PHRASES if p in text), None)
        if hit:
            findings.append(Finding("invented-phrase", "warn", seg["start"], seg["end"],
                                    f'contains "{hit}"', (i,)))
    return findings


def check_noise_tags(segments: list[dict]) -> list[Finding]:
    tagged = [i for i, s in enumerate(segments) if NOISE_TAG.match(s["text"])]
    if segments and len(tagged) / len(segments) > 0.05:
        return [Finding("noise-tags", "warn", 0.0, segments[-1]["end"],
                        f"{len(tagged)} of {len(segments)} segments are only [Music]-style tags",
                        tuple(tagged))]
    return []


def run_checks(segments: list[dict], duration: float | None) -> dict:
    """Findings, summary numbers and an overall verdict: ok, warn or fail."""
    if not segments:
        empty = Finding("empty", "fail", 0.0, duration or 0.0, "the transcript has no segments")
        return {"findings": [empty], "stats": {"segments": 0}, "verdict": "fail"}

    findings = (
        check_order(segments) + check_coverage(segments, duration) + check_gaps(segments)
        + check_repeats(segments) + check_sparse(segments)
        + check_phrases(segments) + check_noise_tags(segments)
    )
    flagged = {i for f in findings for i in f.segment_indexes}
    flagged_share = len(flagged) / len(segments)
    words = sum(len(s["text"].split()) for s in segments)
    minutes = max(segments[-1]["end"], 1) / 60

    if any(f.severity == "fail" for f in findings) or flagged_share > FAIL_FLAGGED_SHARE:
        verdict = "fail"
    else:
        verdict = "warn" if findings else "ok"

    return {
        "findings": findings,
        "verdict": verdict,
        "stats": {
            "segments": len(segments),
            "words": words,
            "minutes": round(minutes, 1),
            "words_per_minute": round(words / minutes),
            "flagged_segments": len(flagged),
            "flagged_share": round(flagged_share, 3),
        },
    }
