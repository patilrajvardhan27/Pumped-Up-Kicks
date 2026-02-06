
**Pumped Up Kicks** is a complete backend system with four core components:

1. **Video Processing & Transcription Pipeline** - Extracts audio from videos and transcribes using OpenAI Whisper (local)
2. **RAG System & Vector Database** - Creates embeddings and stores them in ChromaDB for semantic search
3. **Chatbot API & LLM Integration** - FastAPI backend with Ollama LLM for intelligent Q&A
4. **Backend Infrastructure & Database** - SQLite database for video metadata and chat history

**Key Features:**
- 100% local & free - no API keys or cloud services required
- FastAPI REST API with auto-generated documentation
- Local LLM using Ollama (llama3.2:3b)
- Semantic search with ChromaDB vector database
- Whisper-based transcription with timestamps
- Chat history tracking
- Video upload and management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Future)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────────┐
│                   FastAPI Backend (Port 8000)                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Chat Routes │  │ Video Routes │  │  SQLite DB   │       │
│  └──────┬──────┘  └──────┬───────┘  └──────────────┘       │
│         │                │                                    │
│  ┌──────▼────────────────▼─────┐                            │
│  │   Simple RAG Service         │                            │
│  │   (Ollama Integration)       │                            │
│  └──────────────┬───────────────┘                            │
└─────────────────┼──────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│                     Ollama LLM Server                         │
│                   (llama3.2:3b model)                         │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  CLI Processing Scripts                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐          │
│  │ Transcribe │  │  Embeddings  │  │  Query RAG  │          │
│  │   Video    │─▶│  Generator   │─▶│   (Full)    │          │
│  └────────────┘  └──────────────┘  └─────────────┘          │
│       Whisper         ChromaDB      LangChain + Ollama       │
└───────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before setting up the project, ensure you have:

1. **Python 3.8 or higher** (Python 3.14+ recommended)
2. **ffmpeg** - For video/audio processing
3. **Ollama** - Local LLM server

### Install ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from https://ollama.com/download

**Pull the LLM model:**
```bash
ollama pull llama3.2:3b
```

---

## Installation

### 1. Clone the Repository

```bash
cd /path/to/Pumped_up_kicks/server
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# OR: venv\Scripts\activate  # Windows
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI & Uvicorn (REST API server)
- SQLAlchemy (Database ORM)
- Ollama Python client
- OpenAI Whisper (transcription)
- ChromaDB (vector database)
- sentence-transformers (embeddings)
- LangChain (RAG orchestration)
- moviepy (video processing)

**Note:** First run will download AI models (~1-3GB total):
- Whisper model: ~1GB
- Sentence-transformer model: ~100MB
- Ollama model: ~2GB (if not already pulled)

---

## Quick Start

### Step 1: Start Ollama Server

In a **new terminal window**:

```bash
ollama serve
```

Keep this running in the background.

### Step 2: Start FastAPI Backend

In your **project terminal**:

```bash
cd server
source venv/bin/activate  # Activate virtualenv
./start_server.sh
```

The server will start at: **http://localhost:8000**

### Step 3: Explore the API

Open your browser to:
- **Swagger UI (Interactive Docs):** http://localhost:8000/docs
- **API Root:** http://localhost:8000/
- **Health Check:** http://localhost:8000/health

---

## API Endpoints

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/query` | Ask a question to the AI chatbot |
| GET | `/api/chat/history` | Get conversation history |
| GET | `/api/chat/health` | Check RAG system health |

**Example: Ask a Question**

```bash
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is machine learning?",
    "top_k": 5
  }'
```

**Response:**
```json
{
  "answer": "Machine learning is a type of artificial intelligence...",
  "sources": [],
  "response_time": 1.2,
  "num_sources": 0
}
```

### Video Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | List all uploaded videos |
| GET | `/api/videos/{id}` | Get specific video details |
| POST | `/api/videos/upload` | Upload a new video file |

**Example: List Videos**

```bash
curl http://localhost:8000/api/videos
```

### Documentation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information and version |
| GET | `/health` | Server health status |
| GET | `/docs` | Swagger UI documentation |
| GET | `/redoc` | ReDoc documentation |

---

## CLI Processing Scripts

For full RAG functionality with semantic search and timestamp citations, use the CLI scripts:

### 1. Transcribe Video

Extract audio and generate transcription with timestamps:

```bash
python scripts/transcribe_video.py "data/uploads/lecture_video.mp4"
```

**Options:**
- `--whisper-model`: Model size (`tiny`, `base`, `small`, `medium`, `large`)
- `--language`: Language code (e.g., `en`, `es`)
- `--output-dir`: Output directory (default: `data/transcriptions`)

**Output:**
- `data/transcriptions/<video>_transcript.txt` - Full text
- `data/transcriptions/<video>.srt` - Subtitles (SRT format)
- `data/transcriptions/<video>_segments.json` - Timestamped segments

### 2. Generate Embeddings

Create vector embeddings for semantic search:

```bash
python scripts/generate_embeddings.py "data/transcriptions/<video>_segments.json"
```

**Options:**
- `--embedding-model`: Model name (default: `all-MiniLM-L6-v2`)
- `--chunk-size`: Segments per chunk (default: 3)
- `--batch`: Process all files in directory

**Batch process:**
```bash
python scripts/generate_embeddings.py --batch data/transcriptions/
```

### 3. Query RAG System

Ask questions about lecture content with semantic search:

```bash
python scripts/query_rag.py
```

**Interactive mode:**
```
Query: What topics were covered in the lecture?
Query: Explain the concept of neural networks
Query: exit
```

**Single query:**
```bash
python scripts/query_rag.py --query "What is discussed?" --num-results 5
```

---

## Project Structure

```
server/
├── api/                                # FastAPI application
│   ├── main.py                         # Main app entry point
│   ├── compat.py                       # Python 3.14 compatibility shim
│   ├── models/
│   │   └── database.py                 # SQLite models (Video, ChatHistory)
│   ├── routes/
│   │   ├── chat.py                     # Chat API endpoints
│   │   └── videos.py                   # Video management endpoints
│   └── services/
│       ├── simple_rag_service.py       # Ollama integration (API)
│       └── rag_service.py              # Full RAG service (CLI)
│
├── scripts/                            # CLI processing scripts
│   ├── transcribe_video.py             # Step 1: Video → Transcription
│   ├── generate_embeddings.py          # Step 2: Text → Embeddings
│   └── query_rag.py                    # Step 3: Query RAG system
│
├── src/services/                       # Core services
│   ├── video_processing/               # Audio extraction
│   ├── transcription/                  # Whisper transcription
│   ├── embeddings/                     # Embedding generation
│   └── rag/                            # RAG pipeline (LangChain)
│
├── data/                               # Data directory
│   ├── app.db                          # SQLite database
│   ├── uploads/                        # Uploaded video files
│   ├── temp/                           # Temporary audio files
│   ├── transcriptions/                 # Transcription outputs
│   └── chroma_db/                      # Vector embeddings (ChromaDB)
│
├── start_server.sh                     # Server startup script
├── requirements.txt                    # Python dependencies
└── README.md                           # This file
```

---

## How It Works

### API Workflow

1. **User uploads video** → Saved to `data/uploads/` and metadata stored in SQLite
2. **User asks question** → FastAPI routes to `simple_rag_service.py`
3. **Ollama generates answer** → LLM (llama3.2:3b) processes query
4. **Response returned** → Answer saved to chat history in database

### CLI Workflow (Full RAG)

1. **Video Processing** → Extract audio using moviepy
2. **Transcription** → Whisper generates text segments with timestamps
3. **Chunking** → Combine segments into meaningful chunks
4. **Embedding Generation** → sentence-transformers creates vector embeddings
5. **Vector Storage** → ChromaDB stores embeddings for semantic search
6. **Query Processing** → User query → embedding → similarity search → context retrieval → LLM generation

---

## Database Schema

### Videos Table
```sql
CREATE TABLE videos (
    id INTEGER PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    title TEXT,
    duration FLOAT,
    uploaded_at DATETIME,
    transcription_status TEXT,
    embedding_status TEXT,
    video_path TEXT,
    transcript_path TEXT
);
```

### Chat History Table
```sql
CREATE TABLE chat_history (
    id INTEGER PRIMARY KEY,
    video_id INTEGER,
    session_id TEXT,
    query TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at DATETIME,
    response_time FLOAT,
    num_sources INTEGER
);
```

---

## API Usage Examples

### Python

```python
import requests

# Ask a question
response = requests.post(
    "http://localhost:8000/api/chat/query",
    json={"question": "What is deep learning?"}
)
result = response.json()
print(result['answer'])

# Get chat history
history = requests.get("http://localhost:8000/api/chat/history?limit=10")
print(history.json())
```

### JavaScript (React)

```javascript
const API_BASE = 'http://localhost:8000/api';

async function askQuestion(question) {
    const response = await fetch(`${API_BASE}/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, top_k: 5 })
    });
    return response.json();
}

const result = await askQuestion("Explain neural networks");
console.log(result.answer);
```

### cURL

```bash
# Health check
curl http://localhost:8000/health

# Ask question
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is AI?"}'

# Get chat history
curl "http://localhost:8000/api/chat/history?limit=5"

# List videos
curl http://localhost:8000/api/videos
```

---

## Performance Notes

**Response Times:**
- First API query: ~5-10 seconds (model loading)
- Subsequent queries: ~1-2 seconds
- API endpoints (non-LLM): <100ms

**Model Recommendations:**
- **Whisper**: Use `base` for balance, `small` for better accuracy
- **Embeddings**: `all-MiniLM-L6-v2` (fast), `all-mpnet-base-v2` (accurate)
- **LLM**: `llama3.2:3b` (2GB, fast), `llama3.2:7b` (better quality)

---

## Troubleshooting

### API Issues

**Problem:** Server won't start
- **Solution:** Make sure port 8000 is available: `lsof -i :8000`
- Kill existing process: `pkill -f uvicorn`

**Problem:** Ollama connection error
- **Solution:** Ensure Ollama is running: `ollama serve`
- Check model is installed: `ollama list`

**Problem:** Slow responses
- **Solution:** First query loads model into memory (5-10s). Subsequent queries are faster.

### CLI Script Issues

**Problem:** Out of memory during transcription
- **Solution:** Use smaller Whisper model (`tiny` or `base`)

**Problem:** ChromaDB compatibility error (Python 3.14)
- **Solution:** Use CLI scripts for full RAG (they work). API uses simple Ollama service.

**Problem:** No results in semantic search
- **Solution:** Ensure embeddings were generated: `ls data/chroma_db/`
- Try broader queries or increase `--num-results`

### General Issues

**Problem:** Module not found errors
- **Solution:** Activate virtual environment: `source venv/bin/activate`

**Problem:** ffmpeg not found
- **Solution:** Install ffmpeg (see Prerequisites)

---

## System Status

| Component | Status | Details |
|-----------|--------|---------|
| Python | ✅ | 3.14.2 |
| FastAPI | ✅ | Running on :8000 |
| Ollama | ✅ | llama3.2:3b (2GB) |
| Database | ✅ | SQLite (data/app.db) |
| Whisper | ✅ | base model |
| ChromaDB | ✅ | 0.3.23 (CLI only) |
| LangChain | ✅ | 1.2.8 |
| Embeddings | ✅ | all-MiniLM-L6-v2 |

---

## Known Limitations

- **Full RAG in API:** Currently unavailable due to Python 3.14 + ChromaDB compatibility. Use CLI scripts for full semantic search with timestamp citations.
- **Video Upload:** API endpoint exists but background processing not yet implemented. Use CLI scripts to process videos.
- **Sources:** API returns empty sources array (no document retrieval). CLI scripts provide full source attribution.

**Workaround:** For full RAG functionality, use CLI:
```bash
python scripts/query_rag.py
```

## License

This project is for educational purposes. All AI models used (Whisper, sentence-transformers, Ollama) are open-source and free to use.

