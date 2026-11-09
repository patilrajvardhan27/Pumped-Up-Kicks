#!/usr/bin/env python3
"""
Transcribe one video with Whisper and write its segments next to the others.

Whisper decodes the video itself through ffmpeg, so there is no separate audio
step. Needs requirements-local.txt and ffmpeg on the PATH.
"""
import argparse
import json
from pathlib import Path

# Resolved from this file, not the caller's working directory, so the API
# (which reads transcripts from server/data) finds them wherever it was started.
SERVER_DIR = Path(__file__).resolve().parent.parent
TRANSCRIPTS_DIR = SERVER_DIR / "data" / "transcriptions"


def transcribe_video(video_path: str, output_dir: str = str(TRANSCRIPTS_DIR), model_size: str = "base"):
    import whisper

    print(f"Processing video: {video_path}")
    print(f"Loading Whisper {model_size} model...")
    model = whisper.load_model(model_size)

    result = model.transcribe(video_path, task="transcribe", verbose=False)
    print(f"Detected language: {result.get('language', 'unknown')}")

    segments = [
        {"id": i, "start": seg["start"], "end": seg["end"], "text": seg["text"].strip()}
        for i, seg in enumerate(result.get("segments", []))
    ]

    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True, parents=True)
    segments_file = output_path / f"{Path(video_path).stem}_segments.json"

    data = {
        "video_file": Path(video_path).name,
        "language": result.get("language", "unknown"),
        "full_text": result.get("text", "").strip(),
        "segments": segments,
    }
    with open(segments_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Transcription completed: {segments_file}")
    return {"segments_file": str(segments_file)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path", help="Path to video file")
    parser.add_argument("--output-dir", default=str(TRANSCRIPTS_DIR))
    args = parser.parse_args()

    transcribe_video(args.video_path, args.output_dir)
