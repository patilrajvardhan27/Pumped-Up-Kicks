# Pumped Up Kicks: API

FastAPI service that turns lecture recordings into a searchable, question-answerable
corpus. Architecture and the ask flow are in [docs/README.md](../docs/README.md);
setup and production settings are in [docs/SETUP.md](../docs/SETUP.md).

## Run

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt        # API + tests + pip-audit
cp .env.example .env                       # set ANTHROPIC_API_KEY and DATABASE_URL
alembic upgrade head
./start_server.sh                          # http://localhost:8000/docs (development only)
python -m pytest                           # unit tests, no database needed
```

## Endpoints

Every `/api` route requires a session (a Clerk bearer token, or nothing in
`AUTH_MODE=dev`) and only ever returns the caller's own data.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Public liveness: database reachable, answers available |
| POST | `/api/chat/stream` | Ask (`mode: "ask"`) or run a study tool (`notes`, `terms`, `quiz`); server-sent events |
| GET | `/api/chat/conversations` | Threads, optionally for one lecture (`?video_id=`, `?limit=` up to 100) |
| GET / DELETE | `/api/chat/conversations/{id}` | One thread with its citations / delete it |
| GET | `/api/chat/usage` | Answers this month and the remaining allowance |
| GET | `/api/videos` | Lecture library (`?limit=` up to 200) |
| POST | `/api/videos/presign` | Reserve a slot and get an upload URL |
| POST | `/api/videos/{id}/complete` | Confirm a direct upload; starts processing |
| POST | `/api/videos/upload` | Upload through the API (local storage backend) |
| GET / DELETE | `/api/videos/{id}` | One lecture / delete it with its transcript, index and chats |
| GET | `/api/videos/{id}/transcript` | The lecture as timestamped text |
| GET | `/api/videos/{id}/playback` | A short-lived signed URL for the player |
| GET | `/api/account/export` | Everything stored about the account, as JSON |
| DELETE | `/api/account` | Delete the account and all of its data |

## Layout

```
api/
  main.py            app, routers, /health
  config.py          settings from .env, with production safety checks
  deps.py            get_ctx (session + user) and owned() (fetch-by-id for this user)
  errors.py          safe_detail(): log the detail, return a plain message and a reference
  middleware.py      https redirect, security headers, catch-all 500, CORS
  routes/            chat, videos, media (playback), account
  schemas/           request and response models
  services/
    turns.py               one chat turn: thread, cache, stream, persist
    lecture_rag_service.py retrieval, prompts, streaming answers
    study.py               study tools, citation filtering, transcript rebuilding
    uploads.py             upload validation shared by both upload paths
    pipeline.py            background processing and file cleanup
    auth.py, signing.py, quota.py, ratelimit.py, storage.py, indexer.py, ...
src/services/        embeddings (fastembed) and the Claude client
modal_app.py         serverless GPU transcription worker
alembic/             migrations
tests/, evals/       unit tests and retrieval-quality checks
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `503 Can't reach the database` | Start Postgres, check `DATABASE_URL`, run `alembic upgrade head` |
| Status badge says "Answers unavailable" | Set `ANTHROPIC_API_KEY` in `.env` and restart |
| Startup error about `SECRET_KEY` or `AUTH_MODE` | Production mode is refusing an unsafe setting; the message names it |
| Uploads fail in the browser on R2 | Add the bucket CORS rule from SETUP.md |
| Lecture stuck on "Transcribing" | The server restarted mid-job. Delete the lecture and upload it again |
