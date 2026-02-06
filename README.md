# Pumped Up Kicks

A full-stack application with client and server components.

## Project Structure

```
.
├── client/     # Frontend application
├── server/     # Backend application
└── README.md   # Project documentation
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

The system is divided into **four core components**:

1. Video Processing & Transcription Pipeline
2. RAG System & Vector Database
3. Chatbot API & LLM Integration
4. Backend Infrastructure & Database

### Functional Requirements

- Support video **upload** and/or **URL‑based downloads** (e.g., recorded lectures)
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
