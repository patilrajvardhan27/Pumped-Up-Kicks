# Pumped Up Kicks

A full-stack AI-powered lecture intelligence platform.

## Quick Start

### Prerequisites
- Python 3.11+ (for backend)
- Node.js 18+ and npm (for frontend)
- `ffmpeg` on your PATH (`brew install ffmpeg`)
- Postgres 17+ with pgvector (`brew install postgresql@17 pgvector`)
- A Claude API key — https://console.anthropic.com/settings/keys

### Running the Application

**1. Configure and start the backend**
```bash
cd server
cp .env.example .env        # then set ANTHROPIC_API_KEY in .env
alembic upgrade head        # create the schema
./start_server.sh
```

Full setup instructions, including going to production, are in [SETUP.md](SETUP.md).
The API will be available at `http://localhost:8000`

Transcription, embedding, and search run locally. The Claude API is the only network
call, and it only ever receives the excerpts that matched your question.

**2. Start the Frontend (in a new terminal)**
```bash
cd client
npm install  # First time only
npm run dev
```
The web app will be available at `http://localhost:3000`

**3. Open your browser**
Navigate to `http://localhost:3000` to see the landing page!

## Project Structure

```
.
├── client/                 # Next.js + TypeScript frontend
│   ├── src/
│   │   ├── app/           # Landing page and /app workspace
│   │   ├── components/    # UI components
│   │   ├── services/      # API service layer (REST + SSE)
│   │   └── config/        # Design tokens
│   └── package.json
├── server/                 # FastAPI backend
│   ├── api/               # API routes and services
│   ├── src/               # Core services (Claude client, RAG, embeddings)
│   ├── scripts/           # Video processing scripts
│   └── data/              # Data storage
└── README.md
```

## Getting Started

**"Rewind your lectures, fast‑forward your learning."**

*Like a VCR for your brain — pause, rewind, and replay knowledge exactly when you need it. Every lecture becomes a searchable memory you can access instantly.*

Students deal with online recorded lectures on a daily basis. Yet, they tend to miss the important explanations, and revisiting is a manual and tedious task. Important explanations get buried in the extremely long videos and revisiting requires a fair amount of guesswork.

Notes are incomplete, subjective, or disconnected from the actual lecture and there is no easy way to *ask* a lecture a question later.

This can lead to cognitive exhaustion and poor retention of information.

Pumped‑Up‑Kicks solves this by transforming passive lecture videos into an interactive, searchable, and conversational knowledge system.

### Solution Overview:

Pumped‑Up‑Kicks is an AI‑powered lecture intelligence platform that:

- Converts videos into accurate, timestamped transcripts
- Indexes lecture content for semantic search and retrieval
- Allows users to rewind knowledge by querying lectures in natural language
- Acts as a personal academic memory that grows over time

### System Architecture Overview

The system is divided into four core components:

1. Video Processing & Transcription Pipeline
2. RAG System & Vector Database
3. Chatbot API & LLM Integration
4. Backend Infrastructure & Database

### Functional Requirements

- Support video uploads (e.g., recorded lectures)
- Extract audio streams from video files
- Transcribe audio using Speech‑to‑Text models (e.g., Whisper, Google STT)
- Generate word‑ or sentence‑level timestamps
- Store transcripts linked to original video timecodes
- Maintain video metadata (title, duration, course, upload date)
- Chunk transcripts into semantically meaningful segments
- Generate embeddings for each chunk
- Store embeddings in a vector database (e.g., FAISS, Pinecone, Weaviate)
- Retrieve relevant lecture segments based on user queries
- Preserve timestamps for retrieved chunks
- Accept natural language queries ("Explain Fourier Transform again")
- Use RAG to inject relevant transcript context into prompts
- Generate concise, accurate answers via LLM (GPT, Claude, etc.)
- Reference exact timestamps for cited explanations
- Provide follow‑up question handling
- User authentication & authorization
- Lecture and transcript storage
- Metadata management
- API endpoints for frontend interaction
- Background job handling (video processing, transcription)
- Error handling and logging

### Scope

- Single‑speaker and multi‑speaker lectures
- Long‑form academic content (1–3 hours)
- English language (initially)
- Semantic search across one or multiple lectures
- Context retrieval for downstream LLM responses
- Cross‑user shared knowledge graphs (future enhancement)
- Lecture‑specific Q&A
- Concept clarification and summarization
- Timestamp‑linked answers
- Cloud‑based backend (AWS/GCP/Azure)
- Modular microservice‑friendly design
- Scalable storage for large video files
- Offline‑only usage (for later)

### MVP Deliverables

- Upload a lecture video
- Generate transcript with timestamps
- Ask a question and receive a timestamped answer
- Jump directly to the relevant video moment

Quick Commands

  Start Backend:
  cd server
  source venv/bin/activate
  ./start_server.sh

  Start Frontend:
  cd client
  npm run dev

  Stop Servers:
  # Stop backend
  lsof -ti:8000 | xargs kill

  # Stop frontend
  lsof -ti:3000 | xargs kill

  Restart Both:
  # Stop all
  lsof -ti:8000,3000 | xargs kill

  # Start backend (in background)
  cd server && source venv/bin/activate && ./start_server.sh &

  # Start frontend
  cd client && npm run dev

  ---
  Access Points

  Once both are running:

  - Main App: http://localhost:3000/app
  - Landing: http://localhost:3000
  - API Docs: http://localhost:8000/docs
  - API Health: http://localhost:8000/health

  ---
  Troubleshooting

  Port already in use:
  # Kill processes on ports
  lsof -ti:8000 | xargs kill  # Backend
  lsof -ti:3000 | xargs kill  # Frontend

  Backend won't start:
  # Make sure you're in venv
  cd server
  source venv/bin/activate
  python --version  # Should show Python 3.14

  Frontend won't start:
  # Reinstall dependencies
  cd client
  rm -rf node_modules
  npm install
  npm run dev

Team: Sejal Hukare, Ishita Pawar, Rajvardhan Patil, Chetan Monhot.