import subprocess
import json
from typing import Dict, List, Optional
from pathlib import Path
import time
import ollama


class SimpleRAGService:
    """Simplified RAG service using Ollama directly (avoids Python 3.14 + ChromaDB issues)"""

    def __init__(
        self,
        model_name: str = "llama3.2:3b",
        temperature: float = 0.2
    ):
        self.model_name = model_name
        self.temperature = temperature
        self.server_dir = Path(__file__).parent.parent.parent
        print(f"[Simple RAG Service] Initialized with model: {model_name}")

    def query(
        self,
        question: str,
        video_filter: Optional[str] = None,
        top_k: int = 5
    ) -> Dict:
        start_time = time.time()

        try:
            prompt = f"""You are a helpful AI teaching assistant.

Question: {question}

Please provide a helpful answer. If you don't have specific information, say so.

Answer:"""

            response = ollama.generate(
                model=self.model_name,
                prompt=prompt,
                options={"temperature": self.temperature}
            )

            answer = response['response'].strip()
            response_time = time.time() - start_time

            return {
                "answer": answer,
                "sources": [],
                "response_time": round(response_time, 2),
                "num_sources": 0
            }

        except Exception as e:
            return {
                "answer": f"Error: {str(e)}. Make sure Ollama is running.",
                "sources": [],
                "response_time": time.time() - start_time,
                "num_sources": 0
            }

    def get_stats(self) -> Dict:
        return {
            "status": "healthy",
            "documents_indexed": 0,
            "embedding_model": "N/A (using simple service)",
            "llm_model": self.model_name,
            "vector_store": "N/A (using simple service)"
        }


_rag_service: Optional[SimpleRAGService] = None


def get_rag_service() -> SimpleRAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = SimpleRAGService()
    return _rag_service
