# Server - Video Transcription & RAG System

Backend server for video processing, transcription, embeddings, and RAG-based question answering.

## Features

- **Video Processing**: Extract audio from video files
- **Transcription**: Speech-to-text using OpenAI Whisper (local)
- **Embeddings**: Text embeddings using sentence-transformers
- **Vector Storage**: ChromaDB for semantic search
- **RAG Pipeline**: Question answering over video transcriptions

## Setup

### Prerequisites

- Python 3.8 or higher
- ffmpeg (for video/audio processing)

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

### Install Python Dependencies

**Create a virtual environment (recommended):**

```bash
cd server

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # macOS/Linux
# OR on Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Note:** Always activate the virtual environment before running the scripts:
```bash
source venv/bin/activate  # Run this in the server/ directory
```

This will install:
- `openai-whisper` - Speech-to-text transcription
- `sentence-transformers` - Text embeddings
- `chromadb` - Vector database
- `moviepy` - Video/audio processing
- Other required dependencies

### First-time Model Downloads

The first time you run the scripts, models will be downloaded:
- Whisper models: ~1-10GB depending on model size
- Sentence-transformer models: ~100-500MB

## Usage

You can process videos in two ways:

### Option A: Separate Steps (Recommended)

This gives you more control and lets you review transcriptions before generating embeddings.

#### Step 1: Transcribe Video

Extract audio and transcribe to text:

```bash
python scripts/transcribe_video.py "data/uploads/Classroom Capture Videos (online-video-cutter.com).mp4"
```

This creates:
- `data/transcriptions/<video>_transcript.txt` - Full text
- `data/transcriptions/<video>.srt` - Subtitles
- `data/transcriptions/<video>_segments.json` - Timestamped segments (used for embeddings)

**Transcription options:**
- `--whisper-model`: Model size (`tiny`, `base`, `small`, `medium`, `large`)
  - `tiny`: Fastest, least accurate (~1GB)
  - `base`: Good balance (default, ~1GB)
  - `small`: Better accuracy (~2GB)
  - `medium`: High accuracy (~5GB)
  - `large`: Best accuracy (~10GB)
- `--language`: Language code (e.g., `en`, `es`) - auto-detect if not specified
- `--output-dir`: Output directory (default: `transcriptions`)

**Example:**
```bash
python scripts/transcribe_video.py "data/uploads/video.mp4" \
  --whisper-model small \
  --language en \
  --output-dir data/my_transcripts
```

#### Step 2: Generate Embeddings

Create embeddings from the transcription JSON:

```bash
python scripts/generate_embeddings.py "data/transcriptions/Classroom_Capture_Videos_(online-video-cutter.com)_segments.json"
```

**Embedding options:**
- `--embedding-model`: Sentence-transformer model (default: `all-MiniLM-L6-v2`)
  - `all-MiniLM-L6-v2`: Fast, good quality (384 dim)
  - `all-mpnet-base-v2`: Higher quality (768 dim)
  - `multi-qa-mpnet-base-dot-v1`: Optimized for Q&A
- `--chunk-size`: Segments per chunk (default: 3)
- `--collection-name`: Database collection name (default: `video_transcriptions`)

**Batch process multiple transcriptions:**
```bash
python scripts/generate_embeddings.py --batch data/transcriptions/
```

### Query the RAG System

**Interactive mode:**
```bash
python scripts/query_rag.py
```

Then type your questions:
```
Query: What topics were discussed in the video?
Query: Explain the main concept from the lecture
Query: exit
```

**Single query mode:**
```bash
python scripts/query_rag.py --query "What is the main topic?" --num-results 5
```

## Output Files

### Transcription Output

Files saved to `data/transcriptions/` directory:
- `<video_name>_transcript.txt` - Full transcription text
- `<video_name>.srt` - Subtitle file (SRT format)
- `<video_name>_segments.json` - JSON with all segments and timestamps (needed for embeddings)

### Embeddings Output

- `data/chroma_db/` - Vector database with embeddings (persistent storage)

## Project Structure

```
server/
├── scripts/
│   ├── transcribe_video.py              # Step 1: Transcribe video to text
│   ├── generate_embeddings.py           # Step 2: Create embeddings from transcription
│   └── query_rag.py                     # Query interface for RAG
├── src/
│   └── services/
│       ├── video_processing/
│       │   └── audio_extractor.py       # Extract audio from video
│       ├── transcription/
│       │   └── whisper_transcriber.py   # Whisper transcription
│       ├── embeddings/
│       │   ├── embedding_generator.py   # Generate embeddings
│       │   └── vector_store.py          # ChromaDB integration
│       └── rag/
│           └── rag_pipeline.py          # RAG query pipeline
├── data/
│   ├── uploads/                         # Video files
│   ├── temp/                            # Temporary audio files
│   ├── transcriptions/                  # Transcription outputs (.txt, .srt, .json)
│   └── chroma_db/                       # Vector database (embeddings)
├── config/                              # Configuration files
├── requirements.txt                     # Python dependencies
└── README.md                            # Documentation
```

## How It Works

### Processing Pipeline

1. **Audio Extraction**: Extract audio track from video using moviepy
2. **Transcription**: Transcribe audio using Whisper, get text segments with timestamps
3. **Chunking**: Combine segments into chunks for better context
4. **Embedding Generation**: Generate vector embeddings for each chunk using sentence-transformers
5. **Vector Storage**: Store embeddings in ChromaDB for semantic search

### RAG Query Pipeline

1. **Query Embedding**: Convert user query to vector embedding
2. **Similarity Search**: Find most similar chunks in vector database
3. **Context Building**: Retrieve relevant text segments with timestamps
4. **Results Display**: Show matching segments with similarity scores and timestamps

## Advanced Usage

### Python API

```python
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent / "src"))

from src.services.embeddings.embedding_generator import EmbeddingGenerator
from src.services.embeddings.vector_store import VectorStore
from src.services.rag.rag_pipeline import RAGPipeline

# Initialize
embedding_gen = EmbeddingGenerator(model_name="all-MiniLM-L6-v2")
vector_store = VectorStore(persist_directory="chroma_db")
rag = RAGPipeline(embedding_gen, vector_store)

# Query
results = rag.retrieve("What is discussed?", n_results=5)
for result in results:
    print(f"Time: {result['metadata']['timestamp']}")
    print(f"Text: {result['document']}")
    print(f"Similarity: {1 - result['distance']:.2%}")
```

### Filter by Video

Query specific videos using metadata filters:

```python
results = rag.retrieve(
    "topic",
    n_results=5,
    where={"video_file": "specific_video.mp4"}
)
```

## Performance Tips

- **Whisper Model**: Use `base` for good balance. Use `small` or `medium` for better accuracy if you have a GPU
- **Chunk Size**: Larger chunks (5-10) for general topics, smaller chunks (2-3) for precise timestamps
- **Embedding Model**:
  - `all-MiniLM-L6-v2`: Fast, good quality (384 dim)
  - `all-mpnet-base-v2`: Higher quality (768 dim)
  - `multi-qa-mpnet-base-dot-v1`: Optimized for Q&A

## Troubleshooting

**Out of memory:**
- Use smaller Whisper model (`tiny` or `base`)
- Process shorter video segments
- Use smaller embedding model

**Slow transcription:**
- Whisper is CPU-intensive. For faster processing, use a GPU-enabled environment
- Use smaller model size

**No results in queries:**
- Check that videos have been processed: `python query_rag.py` will show document count
- Try broader queries
- Increase `n_results`
