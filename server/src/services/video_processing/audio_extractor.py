"""Audio extraction from video files."""
import os
from pathlib import Path
from moviepy.editor import VideoFileClip


class AudioExtractor:
    def __init__(self, temp_dir: str = "temp"):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)

    def extract_audio(self, video_path: str, output_format: str = "wav") -> str:
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        audio_filename = f"{video_path.stem}.{output_format}"
        audio_path = self.temp_dir / audio_filename

        print(f"Extracting audio from {video_path.name}...")

        video = VideoFileClip(str(video_path))
        video.audio.write_audiofile(
            str(audio_path),
            codec='pcm_s16le' if output_format == 'wav' else 'mp3',
            verbose=False,
            logger=None
        )
        video.close()

        print(f"Audio extracted to {audio_path}")
        return str(audio_path)

    def cleanup(self, audio_path: str):
        if os.path.exists(audio_path):
            os.remove(audio_path)
            print(f"Cleaned up {audio_path}")
