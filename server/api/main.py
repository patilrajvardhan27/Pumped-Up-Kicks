from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.models.database import init_database
from api.routes import chat, videos


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "="*70)
    print("🚀 Starting Pumped Up Kicks API Server")
    print("="*70)

    print("\n[Database] Initializing SQLite database...")
    init_database()
    print("[Database] ✓ Ready")

    print("\n[RAG System] Initializing (this may take a moment)...")
    print("[RAG System] ✓ Will initialize on first query")

    print("\n" + "="*70)
    print("✅ Server ready!")
    print("📚 API Docs: http://localhost:8000/docs")
    print("🔍 Health Check: http://localhost:8000/api/chat/health")
    print("="*70 + "\n")

    yield
    print("\n👋 Shutting down...")


app = FastAPI(
    title="Pumped Up Kicks API",
    description="AI-powered lecture intelligence platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(videos.router)


@app.get("/")
async def root():
    return {
        "message": "Pumped Up Kicks API",
        "version": "1.0.0",
        "description": "AI-powered lecture intelligence platform",
        "docs": "/docs",
        "endpoints": {
            "chat": "/api/chat/query",
            "videos": "/api/videos",
            "health": "/api/chat/health"
        }
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "message": "Server is running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
