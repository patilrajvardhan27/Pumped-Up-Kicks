# Pumped Up Kicks — Backend

FastAPI service that turns lecture recordings into a searchable, question-answerable corpus.

Four components:

1. **Video processing** — extracts audio and transcribes it with OpenAI Whisper, locally.
2. **Retrieval** — chunks the transcript, embeds it with sentence-transformers, and stores it in FAISS.
3. **Answering** — sends only the retrieved excerpts to the Claude API, which answers with timestamp citations.
4. **Storage** — SQLite for video metadata, chat history, cost accounting, and the answer cache.

Transcription, embedding, and search all run on your machine. The Claude API is the only
network call, and it only ever sees the handful of excerpts that matched the question — never
the audio, and never the full transcript.

---

## Architecture

```
                        ┌──────────────────────────┐
                        │   Next.js client :3000   │
                        └────────────┬─────────────┘
                                     │ REST + SSE
                        ┌────────────▼─────────────┐
                        │   FastAPI  :8000         │
                        │  /api/chat  /api/videos  │
                        └──────┬────────────┬──────┘
                               │            │
              ┌────────────────▼───┐   ┌────▼──────────────────┐
              │ LectureRAGService  │   │  VideoProcessor       │
              └───┬────────────┬───┘   └────┬──────────────┬───┘
                  │            │            │              │
        ┌─────────▼──┐   ┌─────▼───────┐ ┌──▼────────┐ ┌───▼─────────┐
        │ FAISS      │   │ ClaudeClient│ │ Whisper   │ │ Embeddings  │
        │ (local)    │   │ → Claude API│ │ (local)   │ │ (local)     │
        └────────────┘   └─────────────┘ └───────────┘ └─────────────┘
```

Everything talks to Claude through one file: `src/services/llm/claude_client.py`.
Model choice, cost accounting, and error messages live there and nowhere else.

---

## Setup

### Prerequisites

- Python 3.11+ (3.14 tested)
- `ffmpeg` — `brew install ffmpeg` on macOS, `apt install ffmpeg` on Debian/Ubuntu
- A Claude API key — https://console.anthropic.com/settings/keys

### Install

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

First run downloads the Whisper model (~150 MB for `base`) and the embedding model (~90 MB).

### Configure

```bash
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY
```

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Without it the API returns a clear "no key" message instead of an answer. |
| `PUK_CLAUDE_MODEL` | `claude-sonnet-5` | Any Claude model id. `claude-haiku-4-5` is cheaper; `claude-opus-5` is stronger. |
| `PUK_CLAUDE_EFFORT` | `low` | How much the model thinks: `low` → `max`. Grounded Q&A rarely needs more than `low`. |
| `PUK_CLAUDE_MAX_TOKENS` | `2000` | Ceiling on answer length. Unused tokens cost nothing. |

The variables are app-prefixed on purpose — bare `CLAUDE_MODEL` / `CLAUDE_EFFORT` are set by
other tools and would silently override these.

### Run

```bash
./start_server.sh          # http://localhost:8000, docs at /docs
```

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/videos/upload` | Multipart upload; queues processing and returns immediately |
| `GET` | `/api/videos` | List videos with stage and progress |
| `GET` | `/api/videos/{id}/status` | Lightweight status for polling during processing |
| `DELETE` | `/api/videos/{id}` | Removes the file, transcript, and vector entries |
| `POST` | `/api/chat/query` | Ask a question; returns answer, sources, and cost |
| `POST` | `/api/chat/stream` | Same, streamed as server-sent events |
| `GET` | `/api/chat/history` | Past questions with per-answer cost |
| `GET` | `/api/chat/usage` | Running spend, question count, cache-hit rate |
| `GET` | `/api/chat/health` | Index size, models in use |
| `GET` | `/health` | Liveness, model name, whether a key is configured |

---

## Processing pipeline

An upload moves through four stages, each persisted to the `videos` table so the client can
poll `/api/videos/{id}/status` and show exactly where it is:

| Stage | Progress | What happens |
|---|---|---|
| `queued` | 0% | File written to `data/uploads/`, row created |
| `transcribing` | 5% | ffprobe reads duration; Whisper produces timestamped segments |
| `indexing` | 70% | Segments chunked, embedded, appended to the FAISS index |
| `ready` | 100% | Queryable |
| `failed` | 100% | `error_message` holds the reason |

Transcription is the slow step — roughly real time to a few times faster than real time on
CPU, depending on the machine. It runs as a FastAPI background task, so the upload request
returns as soon as the bytes are on disk.

---

## Cost

Only step 4 costs money. A typical question sends ~5 excerpts (2–4k input tokens) and gets
back a few hundred output tokens.

| Model | Input / output per 1M | Rough cost per question |
|---|---|---|
| `claude-haiku-4-5` | $1 / $5 | ~$0.005 |
| `claude-sonnet-5` | $3 / $15 | ~$0.015 |
| `claude-opus-5` | $5 / $25 | ~$0.025 |

Three things keep this down, all on by default:

- **Retrieval, not stuffing.** Only matched excerpts are sent, never the whole transcript.
- **Answer cache.** A repeated question over unchanged content is served from SQLite for $0.
- **Low effort.** `PUK_CLAUDE_EFFORT=low` — the answer is already in the context.

`GET /api/chat/usage` reports what has actually been spent.

---

## CLI

```bash
# Transcribe a video
venv/bin/python scripts/transcribe_video.py data/uploads/lecture.mp4

# Index the transcript
venv/bin/python scripts/generate_embeddings.py data/transcriptions/lecture_segments.json

# Ask a question
venv/bin/python scripts/query_rag.py --query "what are the limitations?"
venv/bin/python scripts/query_rag.py --stats
```

---

## Layout

```
server/
├── api/
│   ├── main.py                        # app, CORS, lifespan, /health
│   ├── models/database.py             # Video, ChatHistory, AnswerCache + migration
│   ├── routes/chat.py                 # query, stream, history, usage, health
│   ├── routes/videos.py               # upload, list, status, delete
│   └── services/
│       ├── lecture_rag_service.py     # retrieval + Claude, used by the API
│       └── video_processor.py         # transcription and indexing pipeline
├── src/services/
│   ├── llm/claude_client.py           # the only place that calls Claude
│   ├── embeddings/                    # sentence-transformers + FAISS
│   ├── transcription/                 # Whisper
│   ├── video_processing/              # audio extraction
│   └── rag/claude_rag.py              # CLI-facing RAG over the same index
├── scripts/                           # transcribe, embed, query
└── data/
    ├── uploads/  transcriptions/  faiss_db/  app.db
```

---

## Troubleshooting

**"No Claude API key found"** — `.env` is missing or has no `ANTHROPIC_API_KEY`. The server
prints whether it found a key at startup.

**Answers say nothing is indexed** — check `GET /api/chat/health`; `documents_indexed` should
be non-zero. If a video shows `ready` but the count is 0, re-run `generate_embeddings.py`.

**Transcription fails immediately** — `ffmpeg` is missing from PATH.

**Processing seems stuck** — Whisper on CPU is slow on long recordings. Watch the server log;
each stage prints when it starts and finishes.
