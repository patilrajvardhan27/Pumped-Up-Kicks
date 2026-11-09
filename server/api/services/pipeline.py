"""
Background processing of one lecture, and removal of everything it left behind.
"""
from api.errors import safe_detail
from api.models.database import Video, get_session
from api.services.storage import get_storage
from api.services.video_processor import USER_SAFE, process_video, transcript_path

FAILED = "Processing failed. Delete this lecture and upload it again."


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
            for field, column in (("duration", "duration_s"), ("num_segments", "num_segments"),
                                  ("num_chunks", "num_chunks")):
                if extra.get(field) is not None:
                    setattr(video, column, extra[field])
            if stage == "failed":
                # Raw reasons can hold paths and library errors; the log keeps them.
                error = extra.get("error")
                video.error_message = error if error in USER_SAFE else safe_detail(
                    error, f"pipeline video={video_id}", FAILED)
            elif stage == "ready":
                video.error_message = None
            db.commit()
            print(f"[Pipeline] video={video_id} stage={stage} {progress}%")

        process_video(db, video, on_stage=on_stage)

    except Exception as e:
        if video is not None:
            try:
                # A commit that failed leaves the session unusable until it is
                # rolled back, so without this the failure below is never saved
                # and the lecture stays on "Transcribing" forever.
                db.rollback()
                video.stage = "failed"
                video.progress = 100
                video.error_message = safe_detail(e, f"pipeline video={video_id}", FAILED)
                db.commit()
            except Exception:
                print(f"[Pipeline] could not record the failure of video={video_id}")
    finally:
        db.close()


def purge_files(video: Video) -> None:
    """
    Delete a lecture's stored file and local transcript. Database rows are the
    caller's job (chunks and chats cascade from the video row).

    The privacy policy promises that deleting a lecture deletes its transcript,
    so failures are logged loudly rather than swallowed.
    """
    try:
        get_storage().delete(video.storage_key)
    except Exception as e:
        safe_detail(e, f"purge object video={video.id}")
    try:
        transcript_path(video.storage_key).unlink(missing_ok=True)
    except OSError as e:
        safe_detail(e, f"purge transcript video={video.id}")
