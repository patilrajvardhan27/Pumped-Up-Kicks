"""
Step 1 of the retrieval eval: get lecture transcripts out of the app and check them.

    python -m evals.transcripts export      # copy ready lectures into evals/data/transcripts
    python -m evals.transcripts check       # quality report, exits 1 if any lecture fails
    python -m evals.transcripts spotcheck   # three moments to verify by ear

Run from server/ with the venv active. Reads the database and the transcript
files the local backend keeps in data/transcriptions. Nothing is written back.
"""
import argparse
import hashlib
import json
import random
import re
import statistics
import sys
from pathlib import Path

from evals.quality import clock, run_checks

EVALS_DIR = Path(__file__).resolve().parent
TRANSCRIPTS_DIR = EVALS_DIR / "data" / "transcripts"
MANIFEST = TRANSCRIPTS_DIR / "manifest.json"

SEVERITY = ('ok', 'warn', 'fail')

# About 250 tokens: the input limit of the current embedder (all-MiniLM-L6-v2).
WORDS_NEAR_TOKEN_LIMIT = 190


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:48] or "lecture"


def digest(segments: list[dict]) -> str:
    """Identifies this exact transcript, so questions can tell when it has changed."""
    return hashlib.sha256(json.dumps(segments, sort_keys=True).encode()).hexdigest()[:16]


# --- export ---------------------------------------------------------------


def export(user_id: str | None) -> int:
    from api.config import settings
    from api.models.database import Video, get_session
    from api.services.video_processor import transcript_path

    user_id = user_id or settings.dev_user_id
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    db = get_session()
    try:
        videos = (
            db.query(Video)
            .filter(Video.user_id == user_id, Video.stage == "ready")
            .order_by(Video.id)
            .all()
        )
        rows = [(v.id, v.title or v.filename, v.filename, v.duration_s, v.storage_key) for v in videos]
    finally:
        db.close()

    if not rows:
        print(f"No ready lectures for user '{user_id}'. Upload one in the workspace and wait for 'Ready'.")
        return 1

    manifest, kept = [], set()
    seen: dict[str, int] = {}  # transcript digest -> the first video that had it
    for video_id, title, filename, duration, storage_key in rows:
        source = transcript_path(storage_key)
        if not source.exists():
            print(f"  skipped {title!r}: no transcript file (processed by a cloud worker, or removed)")
            continue
        data = json.loads(source.read_text(encoding="utf-8"))
        segments = [
            {"start": round(float(s["start"]), 2), "end": round(float(s["end"]), 2), "text": s["text"].strip()}
            for s in data.get("segments", [])
        ]
        name = f"{video_id:03d}-{slugify(title)}.json"
        sha = digest(segments)
        if sha in seen:
            # The app only blocks duplicate file names, so the same recording can be
            # uploaded twice. Counted twice, it would double every passage and let one
            # lecture land on both sides of the dev/test split.
            print(f"  skipped {title!r} (id {video_id}): identical transcript to video {seen[sha]}")
            continue
        seen[sha] = video_id
        record = {
            "video_id": video_id, "title": title, "filename": filename,
            "duration_s": duration, "language": data.get("language"),
            "transcript_sha256": sha, "segments": segments,
        }
        (TRANSCRIPTS_DIR / name).write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
        kept.add(name)
        manifest.append({k: record[k] for k in ("video_id", "title", "duration_s", "language", "transcript_sha256")}
                        | {"file": name, "segments": len(segments)})
        print(f"  exported {name}  ({len(segments)} segments, {clock(duration or 0)})")

    # A lecture deleted in the app must not linger in the eval data.
    for stale in TRANSCRIPTS_DIR.glob("[0-9][0-9][0-9]-*.json"):
        if stale.name not in kept:
            stale.unlink()
            print(f"  removed stale {stale.name} (no longer in the library)")

    MANIFEST.write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"{len(manifest)} lecture(s) in {TRANSCRIPTS_DIR.relative_to(EVALS_DIR.parent)}")
    return 0 if manifest else 1


# --- check ----------------------------------------------------------------


def load_transcripts() -> list[dict]:
    files = sorted(TRANSCRIPTS_DIR.glob("[0-9][0-9][0-9]-*.json"))
    return [json.loads(f.read_text(encoding="utf-8")) | {"file": f.name} for f in files]


def chunk_summary(segments: list[dict]) -> str:
    from api.services.indexer import build_chunks

    words = [len(c["text"].split()) for c in build_chunks(
        [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in segments]
    )]
    if not words:
        return "no chunks"
    over = sum(w > WORDS_NEAR_TOKEN_LIMIT for w in words) / len(words)
    return (f"{len(words)} chunks, median {int(statistics.median(words))} words, max {max(words)}; "
            f"{over:.0%} over {WORDS_NEAR_TOKEN_LIMIT} words (about 250 tokens, the embedder's limit)")


def check() -> int:
    lectures = load_transcripts()
    if not lectures:
        print("Nothing to check. Run: python -m evals.transcripts export")
        return 1

    worst = "ok"
    for lec in lectures:
        report = run_checks(lec["segments"], lec.get("duration_s"))
        st = report["stats"]
        worst = max(worst, report["verdict"], key=SEVERITY.index)
        print(f"\n{lec['file']}  [{report['verdict'].upper()}]")
        if st.get("segments"):
            print(f"  {st['minutes']} min, {st['segments']} segments, {st['words']:,} words, "
                  f"{st['words_per_minute']} words/min, language {lec.get('language')}")
            print(f"  {chunk_summary(lec['segments'])}")
        for f in report["findings"][:12]:
            print(f"  {f.severity:<4} {f.check:<15} {clock(f.start)}-{clock(f.end)}  {f.detail}")
        if len(report["findings"]) > 12:
            print(f"  ... and {len(report['findings']) - 12} more findings")
        if not report["findings"]:
            print("  no findings")
    print(f"\noverall: {worst.upper()}")
    return 1 if worst == "fail" else 0


# --- spot check -------------------------------------------------------------


def spotcheck(count: int, seed: int) -> int:
    lectures = load_transcripts()
    if not lectures:
        print("Nothing to check. Run: python -m evals.transcripts export")
        return 1
    rng = random.Random(seed)
    print("Open each lecture in the workspace, seek to the time, and listen for ten seconds.")
    print("Does what you hear match the text? Report yes or no for each.\n")
    for n in range(count):
        lec = lectures[n % len(lectures)]
        segs = lec["segments"]
        # Spread the picks through the lecture rather than clustering at the start.
        lo, hi = int(len(segs) * n / count), max(int(len(segs) * (n + 1) / count), int(len(segs) * n / count) + 1)
        i = rng.randrange(lo, min(hi, len(segs)))
        print(f"{n + 1}. {lec['title']}  at {clock(segs[i]['start'])}")
        for j in range(max(0, i - 1), min(len(segs), i + 2)):
            marker = ">" if j == i else " "
            print(f"   {marker} {clock(segs[j]['start'])}  {segs[j]['text']}")
        print()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m evals.transcripts", description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    exp = sub.add_parser("export", help="copy ready lectures into evals/data/transcripts")
    exp.add_argument("--user", help="user id (defaults to the dev user)")
    sub.add_parser("check", help="quality report for every exported lecture")
    spot = sub.add_parser("spotcheck", help="pick moments to verify by ear")
    spot.add_argument("--count", type=int, default=3)
    spot.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    if args.command == "export":
        return export(args.user)
    if args.command == "check":
        return check()
    return spotcheck(args.count, args.seed)


if __name__ == "__main__":
    sys.exit(main())
