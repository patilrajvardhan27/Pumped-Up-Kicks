# What you need to do

Steps 01–07 of the production plan are implemented. Everything below is the part
that needs *your* accounts, keys, and card details — I can't create those.

The app runs locally today with only **step 1** done. Steps 2–6 are for going live.

---

## 1. Run it locally (15 minutes)

This is the only section you need to keep developing.

### Postgres with pgvector

The app no longer uses SQLite. It needs Postgres 17+ with the `vector` extension.

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
createdb kicks_dev
psql -d kicks_dev -c "create extension vector;"
```

> **Already done on this machine.** I installed `postgresql@17` and `pgvector`,
> started the service, created `kicks_dev` with the extension enabled, and ran the
> migrations. `server/.env` already points at it. You only need to add your
> Anthropic key.
>
> Note: `pgvector` has no build for `postgresql@14`, which is why this uses 17.
> Your `postgresql@14` service was stopped so the two don't fight over port 5432 —
> if you need it back, stop 17 first (`brew services stop postgresql@17`), since
> only one can hold the port.

### Backend

```bash
cd server
python3 -m venv venv && source venv/bin/activate

pip install -r requirements.txt              # API only
pip install -r requirements-local.txt        # + Whisper, for local transcription

cp .env.example .env
```

Edit `server/.env` and set two things:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com/settings/keys |
| `DATABASE_URL` | `postgresql+psycopg://postgres@127.0.0.1:5432/kicks_dev` |

Then create the schema and start it:

```bash
alembic upgrade head    # already run against kicks_dev
./start_server.sh
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000. With `AUTH_MODE=dev` there's no sign-in — every
request acts as one built-in user. The header shows a **DEV MODE** chip so you
can't ship that by accident.

### Set a spend cap now

In the Anthropic Console → Limits, set a monthly cap. Do this before anything is
reachable from outside your laptop.

---

## 2. Auth — Clerk (30 minutes)

1. Create an application at https://dashboard.clerk.com.
2. Copy the **publishable key** and **secret key**.
3. In the JWT template, make sure `email` is included in the session token claims —
   otherwise users get a placeholder address (the app still works).

`client/.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`server/.env`:
```
AUTH_MODE=clerk
CLERK_JWKS_URL=https://<your-app>.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://<your-app>.clerk.accounts.dev
```

The client detects the publishable key and turns on the sign-in UI by itself. With
no key it stays in dev mode, so local development keeps working.

**Backfill your existing rows** — anything created in dev mode belongs to
`dev_user`. Once you know your real Clerk id:

```sql
update users set id = 'user_xxx' where id = 'dev_user';
```

The foreign keys cascade, so videos, chunks, and conversations follow.

---

## 3. Storage — Cloudflare R2 (20 minutes)

1. Cloudflare dashboard → R2 → create a bucket, e.g. `kicks-lectures`.
2. Create an **R2 API token** with object read/write.
3. Add CORS on the bucket so the browser can PUT directly:

```json
[{
  "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

`server/.env`:
```
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=kicks-lectures
```

With `r2`, the browser uploads straight to the bucket and your API never handles
the bytes. With `local` it falls back to posting through the API — the client
handles both without a code change.

**The CORS block is the step people forget.** Without it uploads fail in the
browser with an opaque network error while `curl` works fine.

---

## 4. Transcription — Modal (30 minutes)

```bash
pip install modal
modal setup                      # opens a browser to authenticate
```

Create the secret the worker reads (same R2 credentials as above):

```bash
modal secret create kicks-r2 \
  R2_ACCOUNT_ID=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET=kicks-lectures
```

Deploy and switch over:

```bash
cd server
modal deploy modal_app.py
```

`server/.env`:
```
TRANSCRIBE_BACKEND=modal
MODAL_APP_NAME=kicks-transcribe
```

Costs about four cents per 60-minute lecture and nothing when idle. Once this is
on, the API container no longer needs Whisper or torch — deploy it with
`requirements.txt` only, and the image drops from ~2.5 GB to ~300 MB.

**If you'd rather ship sooner:** a transcription API (Deepgram) is ~10 lines and
gives speaker labels, at ~$0.36 per lecture instead of $0.04. Swap
`transcribe_modal()` in `api/services/video_processor.py` — nothing else changes.

---

## 5. Deploy (1–2 hours)

**Database — Neon.** Create a project at https://neon.tech, run
`create extension vector;` once, then point `DATABASE_URL` at it. Change the
driver prefix Neon gives you to `postgresql+psycopg://`. Run
`alembic upgrade head` against it.

**API — Railway.** New project from the repo, root directory `server`.

```
Build:  pip install -r requirements.txt
Start:  uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

Set every variable from `server/.env` in Railway's dashboard, and add your
frontend's URL to `CORS_ORIGINS`.

**Frontend — Vercel.** Import the repo, root directory `client`. Set
`NEXT_PUBLIC_API_URL` to the Railway URL and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

**Migrations on deploy.** Run `alembic upgrade head` as a release command, not at
app startup — two containers booting at once would race.

---

## 6. Before you let anyone in

- [ ] `AUTH_MODE=clerk` — confirm the DEV MODE chip is gone from the header
- [ ] Spend cap set in the Anthropic Console
- [ ] `FREE_PLAN_MONTHLY_USD` tuned (default $1.00 ≈ 78 questions on Sonnet)
- [ ] Sign up as a second user and confirm you cannot see the first user's lectures
- [ ] `CORS_ORIGINS` lists only your real frontend domain
- [ ] `SECRET_KEY` set to a real random value — it signs playback URLs, and the
      default lets anyone mint a link to any lecture:
      `python -c "import secrets;print(secrets.token_urlsafe(32))"`
- [ ] Neon backups on (the $19 plan; the free tier's history is short)

---

## Costs at 50 users

| Service | Monthly |
|---|---|
| Claude API | $17–32 |
| Modal | ~$8 |
| Cloudflare R2 | ~$4 |
| Railway | $5–10 |
| Neon | $0–19 |
| Clerk / Vercel | $0 |
| **Total** | **$34–73** |

---

## What changed in the code

### New

| Path | Purpose |
|---|---|
| `server/alembic/` | Migrations. `alembic revision --autogenerate -m "..."` after model changes |
| `server/api/config.py` | All settings in one place, read from `.env` |
| `server/api/deps.py` | `get_ctx` — the only way to get a DB session, and it always carries the user |
| `server/api/services/auth.py` | Clerk JWT verification |
| `server/api/services/storage.py` | R2 / local backends behind one interface |
| `server/api/services/indexer.py` | Chunking and embedding into pgvector |
| `server/api/services/quota.py` | Monthly spend limits |
| `server/modal_app.py` | The serverless GPU transcription worker |
| `server/src/services/embeddings/embedder.py` | fastembed (ONNX) — replaces sentence-transformers |
| `server/api/services/signing.py` | HMAC-signed playback URLs, so a `<video>` tag can stream a private lecture |
| `client/src/components/VideoPlayer.tsx` | The player, with a scrubber that marks cited passages |
| `client/src/lib/timestamps.ts` | Parses `[12:04]` citations and resolves them to a lecture |
| `client/src/components/ConversationList.tsx` | Per-lecture chat threads |
| `client/src/components/Providers.tsx`, `AuthBridge.tsx`, `UserBar.tsx` | Clerk wiring |

### Deleted

All of this was dead once retrieval moved to pgvector:

- `src/services/embeddings/vector_store.py` — the FAISS index
- `src/services/embeddings/embedding_generator.py` — sentence-transformers/torch
- `src/services/rag/` — `rag_pipeline.py` and `claude_rag.py`, both FAISS-based
- `scripts/generate_embeddings.py`, `scripts/query_rag.py` — FAISS CLI tools
- `api/compat.py` — a ChromaDB/Pydantic shim for a dependency that's long gone

### Safe to delete by hand

Leftover data from the FAISS era, which nothing reads any more:

```bash
rm -rf server/data/chroma_db server/data/faiss_db server/data/app.db
```

`app.db` is the old SQLite database — nothing reads it now that everything is in
Postgres. It's still tracked by git, so to stop it showing up in diffs:

```bash
git rm --cached server/data/app.db
```

There's also an orphaned upload at
`server/data/uploads/WhatsApp Video 2026-03-04 at 11.01.18.mp4` with no database
row behind it. Re-upload it through the UI if you want it indexed, or delete it.

I left all of these alone because they're your data, not code.

---

## Things worth knowing

**`Video.filename` is now unique per user, not globally.** Two students can both
upload `lecture1.mp4`. This was a hard blocker before.

**Retrieval filters by owner inside the vector search.** `WHERE chunks.user_id = ...`
runs as part of the query — the thing a FAISS file structurally could not do.
I verified two users with identically-named lectures and overlapping content
retrieve only their own.

**Citations are stored, not just rendered.** `message_sources` links each answer
to the chunks behind it, so the timestamp strip comes back after a reload.

**Chunks got bigger.** ~75 seconds with 18 seconds of overlap, instead of three
Whisper segments (~20s). Fewer, more complete excerpts per answer — cheaper and
more accurate.

**Playback is authenticated by the URL, not a header.** A `<video>` element
can't send `Authorization`, so `/playback` returns a short-lived HMAC-signed
link — the same idea as an R2 presigned URL, implemented for the local backend.
On R2 it returns a real presigned URL instead. Both support HTTP range requests,
which is what makes seeking work.

**`PUK_` prefixes are deliberate.** Bare `CLAUDE_MODEL` / `CLAUDE_EFFORT` are set
by other tools and were silently overriding the app's settings.

---

## Not done

- **Haiku routing and the reranker** from the cost notes — both still worth doing.
- **`BackgroundTasks` is still the queue.** Fine at 50 users; a restart mid-
  transcription loses the job. Redis + RQ when that starts to hurt.
- **Transcript view.** There's no way to read a lecture end to end, only the
  excerpts an answer cited.
