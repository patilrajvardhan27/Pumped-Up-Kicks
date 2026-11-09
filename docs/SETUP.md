# Setup

Section 1 is all you need to develop locally. Sections 2–6 take the app to
production, and section 6 is the security checklist to finish before anyone
else signs in.

---

## 1. Run it locally (15 minutes)

### Postgres with pgvector

The app needs Postgres 17+ with the `vector` extension.

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
createdb kicks_dev
psql -d kicks_dev -c "create extension vector;"
```

If an older Postgres already holds port 5432, stop it first.

### Backend

```bash
cd server
python3 -m venv venv && source venv/bin/activate

pip install -r requirements.txt              # API only
pip install -r requirements-local.txt        # + Whisper, for local transcription
pip install -r requirements-dev.txt          # + tests and pip-audit

cp .env.example .env
```

Edit `server/.env` and set:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com/settings/keys |
| `DATABASE_URL` | `postgresql+psycopg://postgres@127.0.0.1:5432/kicks_dev` |

Then create the schema and start it:

```bash
alembic upgrade head
./start_server.sh
python -m pytest            # optional: the test suite needs no database
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000. With `AUTH_MODE=dev` there's no sign-in: every
request acts as one built-in user, and the header shows a **Dev mode** chip so
it can't ship by accident.

### Set a spend cap now

In the Anthropic Console → Limits, set a monthly cap before anything is
reachable from outside your machine.

---

## 2. Auth with Clerk (30 minutes)

1. Create an application at https://dashboard.clerk.com.
2. Copy the **publishable key**.
3. In the session token claims, include `email`; otherwise users get a
   placeholder address (the app still works).
4. **Sessions → Session lifetime**: set *Inactivity timeout* to 30 minutes and a
   *Maximum lifetime* that suits you (7 days is reasonable). The client also
   signs out after 30 idle minutes on its own (`NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES`),
   but the dashboard setting enforces it server-side.

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
CLERK_AUTHORIZED_PARTIES=http://localhost:3000
```

The client turns on the sign-in UI when it sees the publishable key. With no key
it stays in dev mode.

**Moving dev-mode rows to a real account.** Anything created in dev mode belongs
to `dev_user`. Once you know your Clerk id:

```sql
update users set id = 'user_xxx' where id = 'dev_user';
```

The foreign keys cascade, so videos, chunks and conversations follow.

### How sessions work

| Concern | Where it is handled |
|---|---|
| Cookie flags | Clerk sets them. Its long-lived `__client` cookie lives on Clerk's domain and is `HttpOnly`, `Secure`. The app-domain `__session` cookie is readable by scripts by design, but it is a JWT that expires after ~60 seconds. The API never reads cookies: it takes a bearer token, so CSRF does not apply. |
| Inactivity timeout | Clerk dashboard (server-side) plus `useIdleSignOut` (client-side, shared across tabs). |
| Logout | `signOut()` revokes the session at Clerk; outstanding tokens die within a minute. |
| Session fixation | Clerk issues a new session id on every sign-in. |
| Token checks | `api/services/auth.py`: RS256 signature, `exp`, `iat`, `sub`, issuer, and `azp` against `CLERK_AUTHORIZED_PARTIES`. |

---

## 3. Storage with Cloudflare R2 (20 minutes)

1. Cloudflare dashboard → R2 → create a bucket, e.g. `kicks-lectures`.
2. Create an **R2 API token** with object read/write on that bucket only.
3. Add CORS on the bucket so the browser can PUT directly:

```json
[{
  "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["Content-Type"],
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

With `r2`, the browser uploads straight to the bucket and the API never handles
the bytes. The server picks the upload's content type from the file extension,
and `/complete` measures the stored object and deletes it if it is over the
size limit.

**The CORS block is the step people forget.** Without it, uploads fail in the
browser with an opaque network error while `curl` works fine.

---

## 4. Transcription on Modal (30 minutes)

```bash
pip install modal
modal setup                      # opens a browser to authenticate
modal secret create kicks-r2 \
  R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=kicks-lectures
cd server && modal deploy modal_app.py
```

`server/.env`:
```
TRANSCRIBE_BACKEND=modal
MODAL_APP_NAME=kicks-transcribe
```

About four cents per 60-minute lecture and nothing when idle. The API container
then needs only `requirements.txt`, and the image drops from ~2.5 GB to ~300 MB.

---

## 5. Deploy (1–2 hours)

**Database: Neon.** Create a project at https://neon.tech, run
`create extension vector;` once, then point `DATABASE_URL` at it with the
`postgresql+psycopg://` driver prefix. Run `alembic upgrade head` against it.

**API: Railway.** New project from the repo, root directory `server`.

```
Build:  pip install -r requirements.txt
Start:  uvicorn api.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'
```

Set every variable from `server/.env` in the dashboard, plus `ENVIRONMENT=production`.
Production mode refuses to start with dev auth, a default `SECRET_KEY`, missing
Clerk settings or non-https CORS origins, and it turns on HSTS, an https
redirect, generic error messages and hides `/docs`.

**Frontend: Vercel.** Import the repo, root directory `client`. Set
`NEXT_PUBLIC_API_URL` (https), `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_OPERATOR_NAME` and
`NEXT_PUBLIC_CONTACT_EMAIL`.

**Migrations on deploy.** Run `alembic upgrade head` as a release command, not at
app startup: two containers booting at once would race.

---

## 6. Before you let anyone in

- [ ] `ENVIRONMENT=production` on the API, and it starts cleanly
- [ ] The **Dev mode** chip is gone from the header
- [ ] Clerk inactivity timeout set to 30 minutes
- [ ] `CLERK_AUTHORIZED_PARTIES` lists only the real frontend origin
- [ ] `CORS_ORIGINS` lists only the real frontend origin
- [ ] `SECRET_KEY` is a real random value (it signs playback URLs):
      `python -c "import secrets;print(secrets.token_urlsafe(32))"`
- [ ] Spend cap set in the Anthropic Console
- [ ] `FREE_PLAN_MONTHLY_USD` tuned (default $1.00; a study tool costs roughly
      $0.05–0.15, a typed question about $0.01)
- [ ] Sign up as a second user and confirm you cannot see the first user's lectures
- [ ] `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL` set, so the legal
      pages and `/.well-known/security.txt` name a real contact
- [ ] Have the privacy policy, terms and acceptable use policy reviewed by someone
      qualified for your country before charging anyone
- [ ] Neon backups on (the paid plan; the free tier's history is short)

---

## Costs at 50 users

| Service | Monthly |
|---|---|
| Claude API | $17–40 (more if study tools are heavily used) |
| Modal | ~$8 |
| Cloudflare R2 | ~$4 |
| Railway | $5–10 |
| Neon | $0–19 |
| Clerk / Vercel | $0 |
| **Total** | **$34–81** |

---

## Things worth knowing

**Retrieval filters by owner inside the vector search.** `WHERE chunks.user_id = ...`
runs as part of the query, and `api/deps.py:owned()` is the single place a row
is fetched by id for the signed-in user.

**Study tools read the whole lecture** (up to `STUDY_CONTEXT_TOKENS`), keep only
the passages the answer cites, and are cached per lecture, so a second click is free.

**`PUK_` prefixes are deliberate.** Bare `CLAUDE_MODEL` / `CLAUDE_EFFORT` are set
by other tools and would silently override the app's settings.
