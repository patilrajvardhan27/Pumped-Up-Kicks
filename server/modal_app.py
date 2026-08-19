"""
Serverless GPU transcription worker.

Deploy with:  modal deploy modal_app.py

Pulls a lecture from R2, transcribes it with faster-whisper on an A10G, and
returns timestamped segments. Costs roughly four cents per 60-minute lecture
and nothing at all between uploads, which suits traffic that is dead all term
and then all at once before exams.
"""
import os

import modal

APP_NAME = os.environ.get("MODAL_APP_NAME", "kicks-transcribe")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL_SIZE", "small")

app = modal.App(APP_NAME)

# The model is baked into the image so a cold start doesn't pay to download it.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("faster-whisper==1.1.0", "boto3==1.35.36")
    .run_commands(
        "python -c \"from faster_whisper import WhisperModel; "
        f"WhisperModel('{WHISPER_MODEL}', device='cpu', compute_type='int8')\""
    )
    .env({"WHISPER_MODEL_SIZE": WHISPER_MODEL})
)


@app.function(
    image=image,
    gpu="A10G",
    timeout=3600,
    # R2 credentials live in a Modal secret, never in the image.
    secrets=[modal.Secret.from_name("kicks-r2")],
    scaledown_window=60,
)
def transcribe_from_r2(storage_key: str) -> dict:
    """
    Download one object from R2, transcribe it, and return segments.

    Returns {"status", "language", "duration", "segments": [{start, end, text}]}
    """
    import tempfile

    import boto3
    from botocore.config import Config
    from faster_whisper import WhisperModel

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )

    bucket = os.environ.get("R2_BUCKET", "kicks-lectures")

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        local_path = tmp.name

    try:
        client.download_file(bucket, storage_key, local_path)

        model = WhisperModel(
            os.environ.get("WHISPER_MODEL_SIZE", WHISPER_MODEL),
            device="cuda",
            compute_type="float16",
        )
        segments, info = model.transcribe(local_path, beam_size=5, vad_filter=True)

        return {
            "status": "success",
            "language": info.language,
            "duration": info.duration,
            "segments": [
                {"start": s.start, "end": s.end, "text": s.text.strip()} for s in segments
            ],
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(local_path):
            os.unlink(local_path)


@app.local_entrypoint()
def main(storage_key: str):
    """Smoke test: modal run modal_app.py --storage-key users/dev_user/lecture.mp4"""
    result = transcribe_from_r2.remote(storage_key)
    print(f"status={result['status']} segments={len(result.get('segments', []))}")
