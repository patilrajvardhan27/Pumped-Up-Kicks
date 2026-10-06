#!/usr/bin/env python3
import sys
import json
import argparse
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent / "src"))

from services.video_processing.audio_extractor import AudioExtractor
from services.transcription.whisper_transcriber import WhisperTranscriber

# Folders are resolved from this file, not the caller's working directory, so the
# API (which reads transcripts from server/data) finds them wherever it was started.
SERVER_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = SERVER_DIR / "data" / "temp"
TRANSCRIPTS_DIR = SERVER_DIR / "data" / "transcriptions"


def transcribe_video(video_path: str, output_dir: str = str(TRANSCRIPTS_DIR)):
    print(f"Processing video: {video_path}")

    # Extract audio
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    extractor = AudioExtractor(temp_dir=str(TEMP_DIR))
    audio_path = extractor.extract_audio(video_path)
    print(f"Audio extracted: {audio_path}")

    # Transcribe audio
    transcriber = WhisperTranscriber(model_size="base")
    result = transcriber.transcribe(audio_path)
    segments = transcriber.get_segments(result)

    # Save segments to JSON
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True, parents=True)

    video_name = Path(video_path).stem
    segments_file = output_path / f"{video_name}_segments.json"

    transcription_data = {
        "video_file": Path(video_path).name,
        "language": result.get("language", "unknown"),
        "full_text": transcriber.get_full_text(result),
        "segments": [seg.to_dict() for seg in segments]
    }

    with open(segments_file, "w", encoding="utf-8") as f:
        json.dump(transcription_data, f, indent=2, ensure_ascii=False)

    print(f"Transcription completed: {segments_file}")

    # Cleanup temp audio
    extractor.cleanup(audio_path)

    return {"segments_file": str(segments_file)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path", help="Path to video file")
    parser.add_argument("--output-dir", default=str(TRANSCRIPTS_DIR))

    args = parser.parse_args()

    transcribe_video(args.video_path, args.output_dir)
