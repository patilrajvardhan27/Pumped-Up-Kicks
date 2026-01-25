"""Whisper-based transcription service."""
import whisper
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class TranscriptionSegment:
    id: int
    start: float
    end: float
    text: str

    def to_dict(self) -> dict:
        return {"id": self.id, "start": self.start, "end": self.end, "text": self.text}


class WhisperTranscriber:
    def __init__(self, model_size: str = "base"):
        print(f"Loading Whisper {model_size} model...")
        self.model = whisper.load_model(model_size)
        print("Model loaded successfully")

    def transcribe(self, audio_path: str, language: Optional[str] = None,
                   task: str = "transcribe") -> Dict:
        print(f"Transcribing {audio_path}...")
        options = {"task": task, "verbose": False}
        if language:
            options["language"] = language

        result = self.model.transcribe(audio_path, **options)
        print(f"Transcription complete. Detected language: {result.get('language', 'unknown')}")
        return result

    def get_segments(self, transcription_result: Dict) -> List[TranscriptionSegment]:
        segments = []
        for i, seg in enumerate(transcription_result.get("segments", [])):
            segments.append(TranscriptionSegment(
                id=i, start=seg["start"], end=seg["end"], text=seg["text"].strip()
            ))
        return segments

    def get_full_text(self, transcription_result: Dict) -> str:
        return transcription_result.get("text", "").strip()

    def format_timestamp(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

    def to_srt(self, segments: List[TranscriptionSegment]) -> str:
        srt_lines = []
        for seg in segments:
            srt_lines.append(str(seg.id + 1))
            start_time = self.format_timestamp(seg.start)
            end_time = self.format_timestamp(seg.end)
            srt_lines.append(f"{start_time} --> {end_time}")
            srt_lines.append(seg.text)
            srt_lines.append("")
        return "\n".join(srt_lines)
