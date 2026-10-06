"""
Video storage.

Production uses Cloudflare R2: the browser PUTs straight to a presigned URL and
the API only ever handles the object key, so a 4 GB lecture never passes through
the app server. The local backend keeps the same interface so development needs
no cloud account.
"""
import re
import shutil
import unicodedata
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Optional

from api.config import settings

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_key(user_id: str, filename: str) -> str:
    """
    Build a collision-free object key namespaced by user.

    Keys are per-user, so two students uploading lecture1.mp4 never clash even
    though the filename is identical.
    """
    name = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode()
    name = _SAFE.sub("_", name).strip("._") or "lecture.mp4"
    user_part = _SAFE.sub("_", user_id)
    return f"users/{user_part}/{name}"


class Storage(ABC):
    """Where lecture videos live."""

    @abstractmethod
    def presign_upload(self, key: str, content_type: str) -> Optional[str]:
        """URL the browser can PUT to, or None when uploads go through the API."""

    @abstractmethod
    def presign_download(self, key: str) -> str:
        """URL the player can stream from."""

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def size(self, key: str) -> Optional[int]: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def save_stream(self, key: str, fileobj: BinaryIO) -> int:
        """Fallback path used only by the local backend."""

    @abstractmethod
    def local_path(self, key: str) -> Path:
        """A real file on disk, downloading first if the backend is remote."""


class LocalStorage(Storage):
    """Files under server/data/uploads. Development only."""

    def __init__(self, root: Optional[Path] = None):
        self.root = root or settings.uploads_dir

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        root = self.root.resolve()
        if not str(path).startswith(str(root)):
            raise ValueError(f"Refusing to touch a path outside the uploads dir: {key}")
        return path

    def presign_upload(self, key: str, content_type: str) -> Optional[str]:
        return None  # the client posts to /api/videos/upload instead

    def presign_download(self, key: str) -> str:
        return f"/api/videos/file/{key}"

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def size(self, key: str) -> Optional[int]:
        path = self._path(key)
        return path.stat().st_size if path.exists() else None

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def save_stream(self, key: str, fileobj: BinaryIO) -> int:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as out:
            shutil.copyfileobj(fileobj, out)
        return path.stat().st_size

    def local_path(self, key: str) -> Path:
        return self._path(key)


class R2Storage(Storage):
    """Cloudflare R2 over the S3 API."""

    def __init__(self):
        import boto3
        from botocore.config import Config

        missing = [
            name
            for name, value in [
                ("R2_ACCOUNT_ID", settings.r2_account_id),
                ("R2_ACCESS_KEY_ID", settings.r2_access_key_id),
                ("R2_SECRET_ACCESS_KEY", settings.r2_secret_access_key),
            ]
            if not value
        ]
        if missing:
            raise RuntimeError(
                f"STORAGE_BACKEND=r2 but {', '.join(missing)} not set. See SETUP.md."
            )

        self.bucket = settings.r2_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
            region_name="auto",
        )
        self._cache_dir = settings.uploads_dir / "_r2cache"
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def presign_upload(self, key: str, content_type: str) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=settings.presign_expiry_seconds,
        )

    def presign_download(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=settings.presign_expiry_seconds,
        )

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def size(self, key: str) -> Optional[int]:
        from botocore.exceptions import ClientError

        try:
            return self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"]
        except ClientError:
            return None

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def save_stream(self, key: str, fileobj: BinaryIO) -> int:
        self.client.upload_fileobj(fileobj, self.bucket, key)
        return self.size(key) or 0

    def local_path(self, key: str) -> Path:
        """Pull the object down so a local transcriber can read it."""
        target = self._cache_dir / key.replace("/", "_")
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            self.client.download_file(self.bucket, key, str(target))
        return target


_storage: Optional[Storage] = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = R2Storage() if settings.storage_backend == "r2" else LocalStorage()
        print(f"[Storage] Backend: {settings.storage_backend}")
    return _storage
