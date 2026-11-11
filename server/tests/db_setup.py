"""
Creating the test database with pgvector, and running the migrations against it.
Imported by support.py after it has set the test environment.
"""
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from api.config import settings

SERVER_DIR = Path(__file__).resolve().parent.parent


def ensure_database(url: str, recreate: bool = False) -> None:
    """Create the database (with pgvector) if it does not exist yet."""
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.execute(
                text("select 1 from pg_database where datname = :name"),
                {"name": target.database},
            ).scalar()
            if exists and recreate:
                conn.execute(text(f'drop database "{target.database}" with (force)'))
                exists = False
            if not exists:
                conn.execute(text(f'create database "{target.database}"'))
    finally:
        admin.dispose()


def alembic_config():
    from alembic.config import Config

    config = Config(str(SERVER_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    return config


def migrate(url: str, revision: str = "head", direction: str = "upgrade") -> None:
    """Run alembic against `url`. alembic/env.py reads the URL from settings."""
    from alembic import command

    previous = settings.database_url
    settings.database_url = url
    try:
        getattr(command, direction)(alembic_config(), revision)
    finally:
        settings.database_url = previous
