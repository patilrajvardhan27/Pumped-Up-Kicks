"""
Background processing of one lecture, on its own session after the response is sent.
"""
import logging

from api.models.database import Video, get_session
from api.services.video_processor import process_video

log = logging.getLogger(__name__)


def run_pipeline(video_id: int) -> None:
    """Runs after the response is sent, on its own session."""
    db = get_session()
    video = None
    try:
        video = db.get(Video, video_id)
        if video is None:
            print(f"[Pipeline] video {video_id} vanished before processing")
            return

        def on_stage(stage: str, progress: int, extra: dict):
            video.stage = stage
            video.progress = progress
            if extra.get("duration"):
                video.duration_s = extra["duration"]
            if extra.get("num_segments") is not None:
                video.num_segments = extra["num_segments"]
            if extra.get("num_chunks") is not None:
                video.num_chunks = extra["num_chunks"]
            if stage == "failed":
                video.error_message = extra.get("error")
            elif stage == "ready":
                video.error_message = None
            db.commit()
            print(f"[Pipeline] video={video_id} stage={stage} {progress}%")

        process_video(db, video, on_stage=on_stage)

    except Exception:
        log.exception("Pipeline failed for video %s", video_id)
        if video is not None:
            try:
                # A commit that failed leaves the session unusable until it is
                # rolled back, so without this the failure below was never saved
                # and the lecture stayed on "Transcribing" forever.
                db.rollback()
                video.stage = "failed"
                video.progress = 100
                video.error_message = "Processing failed. Try uploading again."
                db.commit()
            except Exception:
                print(f"[Pipeline] could not record the failure of video={video_id}")
    finally:
        db.close()
