# Setup and launch checklist

Everything here needs an owner's own accounts, keys and card details. The app runs locally with only section 1 done. Sections 2 to 6 are for going live.

## 1. Run it locally

### Postgres with pgvector

The app needs Postgres 17 or newer with the `vector` extension.

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
createdb kicks_dev
psql -d kicks_dev -c "create extension vector;"
```

pgvector has no build for `postgresql@14`. If an older Postgres already holds port 5432, stop it first, since only one can.

### Server

```bash
cd server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt              # API only
pip install -r requirements-local.txt        # adds Whisper, for local transcription
cp .env.example .env
```

Edit `server/.env`:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com/settings/keys |
| `DATABASE_URL` | `postgresql+psycopg://postgres@127.0.0.1:5432/kicks_dev` |
| `ENV` | `development`. When unset the server runs in production mode. |

Then create the schema and start the API:

```bash
alembic upgrade head
./start_server.sh        # http://localhost:8000, docs at /docs
```

### Client

```bash
cd client
npm install
cp .env.example .env.local
npm run dev              # http://localhost:3000
```

With `ENV=development` and `AUTH_MODE=dev` there is no sign-in: every request acts as one built-in user, and the header shows a "Dev mode" badge. The client stays in dev mode while `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is empty.

### Tests

```bash
cd server
pip install -r requirements-dev.txt
python -m pytest tests evals      # 138 tests

cd ../client
npm run lint && npm run typecheck
npm run e2e                       # Playwright with axe; starts the dev server itself
```

The database tests need Postgres with pgvector. They create and migrate their own databases on the same server and are skipped if it is not running. Set `TEST_DATABASE_URL` to use another one; the tests empty it, so never point it at real data. Nothing in the suite calls Claude, Canvas or the embedding model.

### Set a spend cap

In the Anthropic Console, under Limits, set a monthly cap before anything is reachable from outside the local machine.

## 2. Auth: Clerk

1. Create an application at https://dashboard.clerk.com.
2. Copy the publishable key and secret key.
3. In the session token claims, include `email`. Without it users get a placeholder address and the app still works.
4. Under Sessions, set the inactivity timeout to 30 minutes. Availability of this setting depends on the Clerk plan.

The client also signs out idle users by itself after 30 minutes without a click, key press or tab focus, shared across open tabs. Set `NEXT_PUBLIC_IDLE_MINUTES` to change the client-side value, and keep the Clerk setting in step with it.

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
CORS_ORIGINS=http://localhost:3000
```

The server rejects a token whose `azp` claim is not one of `CORS_ORIGINS`. `AUTH_MODE=clerk` is the default and needs `CLERK_JWKS_URL` and `CLERK_ISSUER`; the server refuses to start without them.

Rows created in dev mode belong to `dev_user`. To hand them to a real account, once you know its Clerk id:

```sql
update users set id = 'user_xxx' where id = 'dev_user';
```

Foreign keys cascade, so videos, chunks and conversations follow.

## 3. Storage: Cloudflare R2

1. In the Cloudflare dashboard, R2, create a bucket such as `kicks-lectures`.
2. Create an R2 API token with object read and write.
3. Add CORS on the bucket so the browser can upload directly:

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

With `r2` the browser uploads straight to the bucket and the API never handles the bytes. With `local` it posts through the API; the client handles both. If the site is served from a custom storage domain, add it to `NEXT_PUBLIC_STORAGE_ORIGINS` so the Content-Security-Policy allows it.

The CORS block is the step most often forgotten. Without it, uploads fail in the browser with an opaque network error while `curl` works.

## 4. Transcription: Modal

```bash
pip install modal
modal setup                      # opens a browser to authenticate
```

Create the secret the worker reads, with the same R2 credentials:

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

Cost is roughly four cents per 60-minute lecture and nothing when idle. With Modal handling transcription the API container does not need Whisper or torch: deploy it with `requirements.txt` only, which keeps the image near 300 MB instead of 2.5 GB. A hosted transcription API is the alternative; swap `transcribe_modal()` in `server/api/services/video_processor.py` and nothing else changes.

## 5. Deploy

**Database: Neon.** Create a project at https://neon.tech, run `create extension vector;` once, and point `DATABASE_URL` at it. Change the driver prefix Neon gives you to `postgresql+psycopg://`. Run `alembic upgrade head` against it.

**API: Railway.** New project from the repo, root directory `server`.

```
Build:  pip install -r requirements.txt
Start:  uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

Set every variable from `server/.env` in the Railway dashboard, using the production values in section 6.

**Client: Vercel.** Import the repo, root directory `client`. Set `NEXT_PUBLIC_API_URL` to the Railway URL, `NEXT_PUBLIC_SITE_URL` to the public address, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL` for the legal pages.

**Migrations.** Run `alembic upgrade head` as a release command, not at app startup. Two containers booting at once would race.

## 6. Production hardening

The server treats any `ENV` other than `development` as production and refuses to start unless these are set:

| Variable | Production value |
|---|---|
| `ENV` | `production` (the default when unset) |
| `AUTH_MODE` | `clerk`. `dev` is rejected outside development. |
| `CLERK_JWKS_URL`, `CLERK_ISSUER` | From the Clerk dashboard |
| `ALLOWED_HOSTS` | Comma-separated host names the API is served on, for example `api.example.com`. Other `Host` headers get a 400. |
| `SECRET_KEY` | A random value, not the default: `python -c "import secrets;print(secrets.token_urlsafe(32))"`. It signs playback URLs. |
| `CORS_ORIGINS` | Only the real web origin. CORS is sent without credentials. |
| `PUBLIC_API_URL`, `PUBLIC_APP_URL` | Public https addresses of the API and the web app. After a Canvas OAuth round trip the API redirects the browser to `PUBLIC_APP_URL`. |

Also:

- Serve the API over https only. A production client build refuses an `http://` `NEXT_PUBLIC_API_URL` that is not localhost, because the bearer token would travel in clear.
- In production the API sends `Strict-Transport-Security` (two years, `includeSubDomains`) and the web app sends it with a one-year max age. Browsers ignore it over plain http, so the redirect from http to https belongs to the host. Neither sends `preload`, which is hard to undo.
- In production `/docs`, `/redoc` and `/openapi.json` are not served, and `GET /health` returns only `{"status": "ok"}` or `{"status": "degraded"}`.
- The API sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a `default-src 'none'` Content-Security-Policy on every response, and checks the `Host` header with `TrustedHostMiddleware`.
- The upload presign response does not include the storage key.

### Cookies

The app sets no cookies of its own. Sessions are Clerk tokens sent in an `Authorization: Bearer` header, so the `HttpOnly` and `SameSite` flags do not apply to anything the app controls. Do not add `SameSite=Strict` to Clerk or proxy cookies: the Canvas OAuth redirect is a cross-site navigation back into the app, and a strict cookie would be dropped on that return. Clerk, and PostHog when analytics is on, set their own cookies.

## 7. Canvas (per school)

Canvas has no single API host. Every school runs its own, for example `https://canvas.colorado.edu`, and each school's Canvas admin decides which apps may use it. Students connect with OAuth2 against their own school, using a developer key that school issued for this app. Canvas's API policy forbids multi-user apps from asking students for access tokens they generated themselves, so production has no such option.

### What the school's Canvas admin creates

In Canvas: Admin, Developer Keys, + Developer Key, API Key.

| Field | Value |
|---|---|
| Key name | Pumped Up Kicks, or the operator's name |
| Owner email | The operator's contact address |
| Redirect URIs | `https://<api-host>/api/canvas/oauth/callback`, exactly `PUBLIC_API_URL` plus that path |
| Enforce scopes | On, with only the read-only scopes below |

Scopes (all `GET`; nothing that writes, and no quizzes, submissions, grades or other people):

```
url:GET|/api/v1/users/:id
url:GET|/api/v1/courses
url:GET|/api/v1/courses/:id
url:GET|/api/v1/courses/:course_id/files
url:GET|/api/v1/courses/:course_id/pages
url:GET|/api/v1/courses/:course_id/pages/:url_or_id
url:GET|/api/v1/courses/:course_id/modules
url:GET|/api/v1/courses/:course_id/assignments
url:GET|/api/v1/courses/:course_id/discussion_topics
```

The scope picker in the developer key form shows the exact names a given Canvas version uses. If one differs, use the picker's name and update `SCOPES` in `server/api/services/canvas_auth.py`. After saving, the admin switches the key On and sends back its client ID and secret.

### What the operator configures

`server/.env`:
```
CANVAS_OAUTH_CLIENTS={"https://canvas.example.edu": {"client_id": "...", "client_secret": "..."}}
CANVAS_TOKEN_KEY=<Fernet key>
PUBLIC_API_URL=https://<api-host>
PUBLIC_APP_URL=https://<web-host>
```

Add one entry per school to `CANVAS_OAUTH_CLIENTS`. Generate the token key with `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`. To rotate it, put the new key first and keep the old one after a comma until every student has re-synced.

### How the OAuth return works

Canvas redirects the browser to `/api/canvas/oauth/callback` on the API. The API does not complete the connection there, because the browser carries no bearer token on a redirect. It sends the browser to `PUBLIC_APP_URL/app?canvas_code=...&canvas_state=...`. The signed-in client then posts the pair to `POST /api/canvas/oauth/complete` with its bearer token. The API checks the state against the user, and each state is accepted once, tracked in the `oauth_nonces` table.

Requests to Canvas ignore `HTTP_PROXY` and `HTTPS_PROXY` and reach only public addresses. The API host needs direct outbound https to the school's Canvas and to Canvas's file store, which is a different host.

### Trying it locally

With `AUTH_MODE=dev` you can skip the developer key and use a personal access token for your own Canvas account. Set `CANVAS_ALLOW_PERSONAL_TOKENS=true`, create a token under Account, Settings, New access token, and choose the personal token option in the Canvas dialog. The server refuses to start with this flag and `AUTH_MODE=clerk`.

### What gets imported

For each course a student chooses: files (PDF, PowerPoint, Word), pages, the syllabus, announcements, module names, and assignments with their due dates. Quiz-type assignments keep only their title and due date. Locked or hidden material is skipped. A later sync downloads and re-indexes only what changed.

## 8. Before letting anyone in

- [ ] `ENV=production` (or unset) and `AUTH_MODE=clerk`; the "Dev mode" badge is gone from the header
- [ ] `ALLOWED_HOSTS` lists the API host, and `SECRET_KEY` is a real random value
- [ ] `PUBLIC_API_URL` and `PUBLIC_APP_URL` are the public https addresses
- [ ] `NEXT_PUBLIC_API_URL` is https, and HSTS shows in the response headers of both hosts
- [ ] `CORS_ORIGINS` lists only the real web origin
- [ ] Clerk inactivity timeout is 30 minutes
- [ ] Spend cap set in the Anthropic Console
- [ ] `FREE_PLAN_MONTHLY_USD` tuned (the default of $1.00 is roughly 45 retrieval questions on Sonnet)
- [ ] Signed up as a second user and confirmed the first user's lectures are not visible
- [ ] `CANVAS_TOKEN_KEY` set, `CANVAS_ALLOW_PERSONAL_TOKENS` unset, and each school's redirect URI matches `PUBLIC_API_URL` exactly
- [ ] `/docs` and `/openapi.json` return 404 on the production API
- [ ] `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL` set, so the legal pages and `/.well-known/security.txt` name a responsible party and contact
- [ ] Neon backups on (the free tier's history is short)
- [ ] `pip-audit -r requirements.txt` and `npm audit` reviewed (CI runs both on every push)

## 9. Costs at 50 users

| Service | Monthly |
|---|---|
| Claude API | $17 to $32 |
| Modal | about $8 |
| Cloudflare R2 | about $4 |
| Railway | $5 to $10 |
| Neon | $0 to $19 |
| Clerk, Vercel | $0 |
| **Total** | **$34 to $73** |

These are estimates from vendor pricing pages; see [ARCHITECTURE.md](ARCHITECTURE.md) for the per-question arithmetic.

## 10. Notes

- `Video.filename` is unique per user, not globally, so two students can both upload `lecture1.mp4`.
- Retrieval filters by owner inside the vector search (`WHERE chunks.user_id = ...`).
- Citations are stored: `message_sources` links each answer to its chunks, so the timestamp strip survives a reload.
- Playback is authenticated by the URL. A `<video>` element cannot send `Authorization`, so `/playback` returns a short-lived signed link, or a presigned URL on R2. Both support range requests, which is what makes seeking work.
- The `PUK_` prefix on `PUK_CLAUDE_MODEL`, `PUK_CLAUDE_EFFORT` and `PUK_CLAUDE_MAX_TOKENS` is deliberate. Bare `CLAUDE_MODEL` and `CLAUDE_EFFORT` are set by other tools and would silently override the app's settings.
