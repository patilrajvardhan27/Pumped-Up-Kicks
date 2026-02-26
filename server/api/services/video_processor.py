import subprocess
import json
import time
from pathlib import Path
from typing import Dict, Optional

class VideoProcessor:
    def __init__(self):
        self.server_dir = Path(__file__).parent.parent.parent
        self.scripts_dir = self.server_dir / "scripts"
        self.data_dir = self.server_dir / "data"
        self.python_path = str(self.server_dir / "venv" / "bin" / "python3")

    def transcribe_video(self, video_path: str, video_id: int) -> Dict:
        try:
            print(f"\n[Transcription] Starting transcription for video {video_id}")
            print(f"[Transcription] File: {video_path}")
            print(f"[Transcription] Using Python: {self.python_path}")
            start_time = time.time()

            result = subprocess.run(
                [self.python_path, str(self.scripts_dir / "transcribe_video.py"), video_path],
                capture_output=True,
                text=True,
                timeout=600
            )

            elapsed = time.time() - start_time

            if result.stdout:
                print(f"[Transcription] stdout:\n{result.stdout}")
            if result.stderr:
                print(f"[Transcription] stderr:\n{result.stderr}")

            if result.returncode == 0:
                video_name = Path(video_path).stem
                segments_file = self.data_dir / "transcriptions" / f"{video_name}_segments.json"

                if segments_file.exists():
                    print(f"[Transcription] Completed in {elapsed:.1f}s")
                    return {
                        "status": "success",
                        "segments_file": str(segments_file),
                        "message": "Transcription completed"
                    }

            print(f"[Transcription] FAILED (exit code {result.returncode}) after {elapsed:.1f}s")
            return {
                "status": "error",
                "message": result.stderr or "Transcription failed"
            }

        except subprocess.TimeoutExpired:
            print(f"[Transcription] TIMEOUT after 600s")
            return {
                "status": "error",
                "message": "Transcription timeout (10 minutes)"
            }
        except Exception as e:
            print(f"[Transcription] EXCEPTION: {e}")
            return {
                "status": "error",
                "message": str(e)
            }

    def generate_embeddings(self, segments_file: str) -> Dict:
        try:
            print(f"\n[Embeddings] Starting embedding generation")
            print(f"[Embeddings] Segments file: {segments_file}")
            start_time = time.time()

            result = subprocess.run(
                [self.python_path, str(self.scripts_dir / "generate_embeddings.py"), segments_file],
                capture_output=True,
                text=True,
                timeout=300
            )

            elapsed = time.time() - start_time

            if result.stdout:
                print(f"[Embeddings] stdout:\n{result.stdout}")
            if result.stderr:
                print(f"[Embeddings] stderr:\n{result.stderr}")

            if result.returncode == 0:
                print(f"[Embeddings] Completed in {elapsed:.1f}s")
                return {
                    "status": "success",
                    "message": "Embeddings generated"
                }

            print(f"[Embeddings] FAILED (exit code {result.returncode}) after {elapsed:.1f}s")
            return {
                "status": "error",
                "message": result.stderr or "Embedding generation failed"
            }

        except subprocess.TimeoutExpired:
            print(f"[Embeddings] TIMEOUT after 300s")
            return {
                "status": "error",
                "message": "Embedding generation timeout (5 minutes)"
            }
        except Exception as e:
            print(f"[Embeddings] EXCEPTION: {e}")
            return {
                "status": "error",
                "message": str(e)
            }

    def process_video(self, video_path: str, video_id: int) -> Dict:
        transcribe_result = self.transcribe_video(video_path, video_id)

        if transcribe_result["status"] != "success":
            return transcribe_result

        segments_file = transcribe_result["segments_file"]
        embedding_result = self.generate_embeddings(segments_file)

        return {
            "transcription": transcribe_result,
            "embeddings": embedding_result,
            "overall_status": embedding_result["status"]
        }

_processor: Optional[VideoProcessor] = None

def get_video_processor() -> VideoProcessor:
    global _processor
    if _processor is None:
        _processor = VideoProcessor()
    return _processor
