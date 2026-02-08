import subprocess
import json
from pathlib import Path
from typing import Dict, Optional

class VideoProcessor:
    def __init__(self):
        self.server_dir = Path(__file__).parent.parent.parent
        self.scripts_dir = self.server_dir / "scripts"
        self.data_dir = self.server_dir / "data"

    def transcribe_video(self, video_path: str, video_id: int) -> Dict:
        try:
            result = subprocess.run(
                ["python3", str(self.scripts_dir / "transcribe_video.py"), video_path],
                capture_output=True,
                text=True,
                timeout=600
            )

            if result.returncode == 0:
                video_name = Path(video_path).stem
                segments_file = self.data_dir / "transcriptions" / f"{video_name}_segments.json"

                if segments_file.exists():
                    return {
                        "status": "success",
                        "segments_file": str(segments_file),
                        "message": "Transcription completed"
                    }

            return {
                "status": "error",
                "message": result.stderr or "Transcription failed"
            }

        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "message": "Transcription timeout (10 minutes)"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }

    def generate_embeddings(self, segments_file: str) -> Dict:
        try:
            result = subprocess.run(
                ["python3", str(self.scripts_dir / "generate_embeddings.py"), segments_file],
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode == 0:
                return {
                    "status": "success",
                    "message": "Embeddings generated"
                }

            return {
                "status": "error",
                "message": result.stderr or "Embedding generation failed"
            }

        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "message": "Embedding generation timeout (5 minutes)"
            }
        except Exception as e:
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
