"""
One-click study tools: revision notes, key terms and a practice quiz.

These are whole-lecture tasks. Top-k retrieval cannot answer "list every key
term", because the answer is spread over the entire recording, so a study tool
reads the lecture's passages in order instead of the closest few. Everything
else (streaming, citations, quota, caching, history) is the normal ask path.
"""
import re
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class StudyTool:
    label: str        # what the student sees as the question in the chat
    instruction: str  # appended to the system prompt


TOOLS: Dict[str, StudyTool] = {
    "notes": StudyTool(
        label="Revision notes for this lecture",
        instruction=(
            "Task: write revision notes for the whole lecture. Use short headings in the order "
            "topics were taught, with concise bullet points under each. Cite a timestamp for "
            "every bullet. Finish with a three-line 'In short' summary."
        ),
    ),
    "terms": StudyTool(
        label="Key terms from this lecture",
        instruction=(
            "Task: list the key terms, definitions, formulas and named ideas the lecturer "
            "introduced, in the order they appear. Format each as '**Term**: one-sentence "
            "definition in the lecturer's words [timestamp]'."
        ),
    ),
    "quiz": StudyTool(
        label="Quiz me on this lecture",
        instruction=(
            "Task: write a 5-question practice quiz on the most important ideas. Mix multiple "
            "choice (options A to D) with short-answer questions. Put all answers in an "
            "'Answers' section at the end, each with a one-line explanation and the timestamp "
            "where the lecture covers it."
        ),
    ),
}


def tool_for(mode: str) -> Optional[StudyTool]:
    return TOOLS.get(mode)


# Mirrors CITATION_SPLIT in client/src/lib/timestamps.ts: [12:04], [1:02:33], [0:00 - 0:35].
_CLOCK = r"\d{1,2}:\d{2}(?::\d{2})?"
_CITATION = re.compile(rf"\[({_CLOCK})(?:\s*[-–]\s*{_CLOCK})?\]")


def parse_clock(text: str) -> Optional[int]:
    try:
        parts = [int(p) for p in text.split(":")]
    except ValueError:
        return None
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def cited_sources(answer: str, sources: List[Dict]) -> List[Dict]:
    """
    Keep only the passages the answer actually cites.

    A study tool reads every passage of the lecture; listing all of them under
    the answer would bury the few that matter.
    """
    seconds = [s for s in (parse_clock(m) for m in _CITATION.findall(answer)) if s is not None]
    return [
        source for source in sources
        if any(source["start"] <= t <= source["end"] for t in seconds)
    ]


def _words(text: str) -> List[str]:
    return text.split()


def _overlap(previous: List[str], current: List[str], limit: int = 400) -> int:
    """Length of the longest suffix of `previous` that starts `current`."""
    for size in range(min(len(previous), len(current), limit), 0, -1):
        if previous[-size:] == current[:size]:
            return size
    return 0


def transcript_lines(chunks: List[Dict]) -> List[Dict]:
    """
    Rebuild a readable transcript from overlapping index chunks.

    Chunks are whole Whisper segments joined with spaces, and each one repeats
    the last ~18 seconds of the previous one. The repeated words are dropped
    and the line starts where the previous chunk ended.
    """
    lines: List[Dict] = []
    previous: List[str] = []
    previous_end = 0.0

    for chunk in sorted(chunks, key=lambda c: c["start"]):
        words = _words(chunk["text"])
        cut = _overlap(previous, words)
        text = " ".join(words[cut:]).strip()
        if text:
            start = max(chunk["start"], previous_end) if cut else chunk["start"]
            lines.append({"start": start, "end": chunk["end"], "text": text})
        previous, previous_end = words, chunk["end"]

    return lines
