# Server

FastAPI service that turns lecture recordings and Canvas course material into a searchable, question-answerable corpus. Claude sees only the excerpts that matched a question, never the audio or the full transcript.

## Layout

```
server/
  api/
    main.py         app setup, exception handlers, router registration, /health
    middleware.py   generic 500s, upload size cap, security headers
    config.py       every setting, read from the environment and server/.env
    deps.py         request context: the database session and the signed-in user
    models/         SQLAlchemy models by domain (library, chat, study, canvas); database.py holds the engine
    schemas/        request and response models (chat, videos, canvas, study)
    routes/         chat, conversations, videos, media, workspaces, documents, canvas, canvas_courses,
                    study, practice, search, account
    services/       one job per module: answering (lecture_rag_service, retrieval, sources, turns),
                    study (study, practice, study_records), Canvas (canvas_auth, token_crypto,
                    canvas_connection, canvas_sync, canvas_course, canvas_readers), uploads, pipeline,
                    cleanup, claude_client, claude_usage, quota, ratelimit and the rest
  alembic/          migrations
  scripts/          transcribe_video.py, the local Whisper subprocess
  tests/            pytest suite (Postgres with pgvector required); support.py, fakes.py, db_setup.py are shared
  evals/            transcript quality checks, run with the tests
  modal_app.py      serverless GPU transcription worker
  start_server.sh   uvicorn with reload on port 8000
```

All calls to Claude go through `api/services/claude_client.py`.

## Commands

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-local.txt   # local-only: adds Whisper
cp .env.example .env                                         # set ANTHROPIC_API_KEY
alembic upgrade head                                         # create or update the schema
./start_server.sh                                            # http://localhost:8000

pip install -r requirements-dev.txt
python -m pytest tests evals                                 # 138 tests
pip-audit -r requirements.txt                                # dependency audit (pip install pip-audit)
alembic revision --autogenerate -m "describe the change"     # after changing models
```

Needs Python 3.12, ffmpeg on the PATH for local transcription, and PostgreSQL 17 with pgvector. Tests use `TEST_DATABASE_URL` (default `kicks_test` on the local server), create and empty it, and skip when Postgres is not running. Nothing in them calls Claude or Canvas.

## Configuration

Copy `.env.example`; every variable is documented there, and [../docs/SETUP.md](../docs/SETUP.md) covers Clerk, R2, Modal, Canvas and production hardening. Locally set `ENV=development`: without it the server runs in production mode and requires `AUTH_MODE=clerk`, Clerk URLs, `ALLOWED_HOSTS` and a real `SECRET_KEY`.

The Claude settings are prefixed `PUK_` (`PUK_CLAUDE_MODEL`, `PUK_CLAUDE_EFFORT`, `PUK_CLAUDE_MAX_TOKENS`) on purpose: bare `CLAUDE_MODEL` and `CLAUDE_EFFORT` are set by other tools and would silently override them.

`GET /health` returns only `{"status": "ok"}` or `"degraded"`. `/docs` and `/openapi.json` exist only with `ENV=development`.

## Troubleshooting

- **"No Claude API key found":** `.env` has no `ANTHROPIC_API_KEY`.
- **Exits at startup with a settings error:** the message names the missing production setting. For local work, set `ENV=development`.
- **Transcription fails immediately:** ffmpeg is missing from the PATH.
