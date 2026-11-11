# Canvas setup (per school)

Canvas has no single API host. Every school runs its own, for example `https://canvas.colorado.edu`, and each school's Canvas admin decides which apps may use it. Students connect with OAuth2 against their own school, using a developer key that school issued for this app. Canvas's API policy forbids multi-user apps from asking students for access tokens they generated themselves, so production has no such option.

## What the school's Canvas admin creates

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

## What the operator configures

`server/.env`:
```
CANVAS_OAUTH_CLIENTS={"https://canvas.example.edu": {"client_id": "...", "client_secret": "..."}}
CANVAS_TOKEN_KEY=<Fernet key>
PUBLIC_API_URL=https://<api-host>
PUBLIC_APP_URL=https://<web-host>
```

Add one entry per school to `CANVAS_OAUTH_CLIENTS`. Generate the token key with `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`. To rotate it, put the new key first and keep the old one after a comma until every student has re-synced.

## How the OAuth return works

Canvas redirects the browser to `/api/canvas/oauth/callback` on the API. The API does not complete the connection there, because the browser carries no bearer token on a redirect. It sends the browser to `PUBLIC_APP_URL/app?canvas_code=...&canvas_state=...`. The signed-in client then posts the pair to `POST /api/canvas/oauth/complete` with its bearer token. The API checks the state against the user, and each state is accepted once, tracked in the `oauth_nonces` table.

Requests to Canvas ignore `HTTP_PROXY` and `HTTPS_PROXY` and reach only public addresses. The API host needs direct outbound https to the school's Canvas and to Canvas's file store, which is a different host.

## Trying it locally

With `AUTH_MODE=dev` you can skip the developer key and use a personal access token for your own Canvas account. Set `CANVAS_ALLOW_PERSONAL_TOKENS=true`, create a token under Account, Settings, New access token, and choose the personal token option in the Canvas dialog. The server refuses to start with this flag and `AUTH_MODE=clerk`.

## What gets imported

For each course a student chooses: files (PDF, PowerPoint, Word), pages, the syllabus, announcements, module names, and assignments with their due dates. Quiz-type assignments keep only their title and due date. Locked or hidden material is skipped. A later sync downloads and re-indexes only what changed.

Back to [SETUP.md](SETUP.md).
