#!/usr/bin/env python3
import sys
import argparse
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent / "src"))

from services.video_processing.audio_extractor import extract_audio
from services.transcription.whisper_transcriber import transcribe_audio

def transcribe_video(video_path: str, output_dir: str = "data/transcriptions"):
    print(f"Processing video: {video_path}")

    audio_path = extract_audio(video_path, output_dir="data/temp")
    print(f"Audio extracted: {audio_path}")

    transcription = transcribe_audio(audio_path, output_dir=output_dir)
    print(f"Transcription completed: {transcription['segments_file']}")

    return transcription

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path", help="Path to video file")
    parser.add_argument("--output-dir", default="data/transcriptions")

    args = parser.parse_args()

    transcribe_video(args.video_path, args.output_dir)
