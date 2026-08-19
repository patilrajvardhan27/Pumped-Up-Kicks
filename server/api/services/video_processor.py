"""
The upload -> transcript -> index pipeline.

Two transcription backends behind one interface: a local Whisper subprocess for
development, and a Modal serverless GPU function for production. Both drive the
same stage/progress fields, so the UI never knows which one ran.
"""
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional

from sqlalchemy.orm import Session

SERVER_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(SERVER_DIR / "src"))

from api.config import settings
from api.models.database import Video
from api.services.indexer import index_transcript
from api.services.storage import get_storage

STAGES = ("queued", "transcribing", "indexing", "ready", "failed")

STAGE_LABELS = {
    "queued": "Queued",
    "transcribing": "Transcribing audio",
    "indexing": "Building search index",
    "ready": "Ready to query",
    "failed": "Failed",
}


def probe_duration(path: Path) -> Optional[float]:
    """Read a video's runtime with ffprobe. None if it can't be determined."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0 and result.stdout.strip():
            return round(float(result.stdout.strip()), 2)
    except Exception as e:
        print(f"[Probe] Could not read duration: {e}")
    return None


# --- transcription backends -------------------------------------------------


def transcribe_local(storage_key: str) -> Dict:
    """Run the existing Whisper script in a subprocess."""
    storage = get_storage()
    try:
        local_path = storage.local_path(storage_key)
    except Exception as e:
        return {"status": "error", "message": f"Could not read the uploaded file: {e}"}

    if not local_path.exists():
        return {"status": "error", "message": "Uploaded file is missing from storage."}

    python_path = str(SERVER_DIR / "venv" / "bin" / "python3")
    script = SERVER_DIR / "scripts" / "transcribe_video.py"

    print(f"[Transcribe:local] {local_path.name}")
    started = time.time()

    result = subprocess.run(
        [python_path, str(script), str(local_path)],
        capture_output=True, text=True, timeout=3600,
    )

    if result.stdout:
        print(result.stdout[-2000:])
    if result.stderr:
        print(result.stderr[-2000:])

    if result.returncode != 0:
        return {
            "status": "error",
            "message": (result.stderr or "Transcription failed").strip()[-500:],
        }

    segments_file = settings.transcripts_dir / f"{local_path.stem}_segments.json"
    if not segments_file.exists():
        return {"status": "error", "message": "Transcription produced no segments file."}

    with segments_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"[Transcribe:local] done in {time.time() - started:.1f}s")
    return {
        "status": "success",
        "segments": data.get("segments", []),
        "language": data.get("language"),
    }


def transcribe_modal(storage_key: str) -> Dict:
    """Dispatch to the deployed Modal function (see modal_app.py)."""
    try:
        import modal

        fn = modal.Function.from_name(settings.modal_app_name, "transcribe_from_r2")
        print(f"[Transcribe:modal] dispatching {storage_key}")
        result = fn.remote(storage_key)

        if result.get("status") != "success":
            return {"status": "error", "message": result.get("message", "Modal job failed")}

        return {
            "status": "success",
            "segments": result.get("segments", []),
            "language": result.get("language"),
            "duration": result.get("duration"),
        }

    except Exception as e:
        return {
            "status": "error",
            "message": (
                f"Could not reach the Modal transcription worker: {e}. "
                "Check `modal deploy modal_app.py` has run."
            ),
        }


def transcribe(storage_key: str) -> Dict:
    if settings.transcribe_backend == "modal":
        return transcribe_modal(storage_key)
    return transcribe_local(storage_key)


# --- pipeline ---------------------------------------------------------------


def process_video(
    db: Session,
    video: Video,
    on_stage: Optional[Callable[[str, int, Dict], None]] = None,
) -> Dict:
    """Transcribe then index one video, reporting progress as it goes."""

    def report(stage: str, progress: int, **extra):
        if on_stage:
            on_stage(stage, progress, extra)

    storage_key = video.storage_key
    user_id = video.user_id
    video_id = video.id

    duration = None
    if settings.storage_backend == "local":
        try:
            duration = probe_duration(get_storage().local_path(storage_key))
        except Exception:
            duration = None

    report("transcribing", 5, duration=duration)

    result = transcribe(storage_key)

    if result["status"] != "success":
        report("failed", 100, error=result.get("message"))
        return {"overall_status": "error", "message": result.get("message")}

    segments: List[Dict] = result.get("segments", [])
    report(
        "indexing",
        70,
        num_segments=len(segments),
        duration=result.get("duration") or duration,
    )

    try:
        num_chunks = index_transcript(db, video_id, user_id, segments)
    except Exception as e:
        report("failed", 100, error=f"Indexing failed: {e}")
        return {"overall_status": "error", "message": str(e)}

    if num_chunks == 0:
        report("failed", 100, error="No speech was found in this recording.")
        return {"overall_status": "error", "message": "No speech found"}

    report("ready", 100, num_chunks=num_chunks)
    return {"overall_status": "success", "num_chunks": num_chunks}
