"""
RAG Service - Integrates existing RAG system with Ollama LLM.

This service combines:
- Existing RAG pipeline for document retrieval
- Ollama for LLM-powered answers
- Prompt engineering for lecture Q&A
"""
# Apply compatibility shim first (for ChromaDB + Pydantic 2.x)
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import api.compat  # noqa: F401

from typing import List, Dict, Optional
import time

# Add src to path
src_path = Path(__file__).parent.parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from services.embeddings.embedding_generator import EmbeddingGenerator
from services.embeddings.vector_store import VectorStore
from services.rag.rag_pipeline import RAGPipeline
import ollama


class LectureRAGService:
    """
    RAG service for lecture Q&A using existing RAG system + Ollama.

    Features:
    - Semantic search using existing ChromaDB
    - LLM-powered answers via Ollama
    - Timestamp citations
    - Video filtering
    - Response time tracking
    """

    def __init__(
        self,
        persist_dir: str = "data/chroma_db",
        model_name: str = "llama3.2:3b",
        embedding_model: str = "all-MiniLM-L6-v2",
        temperature: float = 0.2,
        top_k: int = 5
    ):
        """Initialize the RAG service"""
        self.model_name = model_name
        self.temperature = temperature
        self.top_k = top_k

        print(f"[RAG Service] Initializing...")
        print(f"  - Embedding model: {embedding_model}")
        print(f"  - LLM model: {model_name}")
        print(f"  - ChromaDB: {persist_dir}")

        # Initialize existing RAG components
        self.embedding_gen = EmbeddingGenerator(model_name=embedding_model)
        self.vector_store = VectorStore(persist_directory=persist_dir)
        self.rag = RAGPipeline(self.embedding_gen, self.vector_store)

        print(f"[RAG Service] ✓ Ready!")

    def _build_prompt(self, question: str, context: str) -> str:
        """Build the prompt for Ollama"""
        return f"""You are a helpful AI teaching assistant helping students understand lecture content.

Use the lecture context below to answer the student's question accurately.
If you cannot find the answer in the provided context, clearly say so - don't make up information.

IMPORTANT: Always cite specific timestamps when referencing parts of the lecture.

Lecture Context:
{context}

Question: {question}

Answer (with timestamp citations):"""

    def query(
        self,
        question: str,
        video_filter: Optional[str] = None,
        top_k: Optional[int] = None
    ) -> Dict:
        """
        Query the lecture content with LLM-powered answer.

        Args:
            question: User's question
            video_filter: Optional video filename to filter by
            top_k: Number of results to retrieve (default: 5)

        Returns:
            {
                "answer": "LLM-generated response",
                "sources": [{"text": "...", "timestamp": "...", "video": "..."}],
                "response_time": 1.23,
                "num_sources": 5
            }
        """
        start_time = time.time()
        k = top_k or self.top_k

        try:
            # Step 1: Retrieve relevant documents using existing RAG
            where_filter = {"video_file": video_filter} if video_filter else None
            results = self.rag.retrieve(
                query=question,
                n_results=k,
                where=where_filter
            )

            if not results:
                return {
                    "answer": "No relevant information found in the lectures.",
                    "sources": [],
                    "response_time": time.time() - start_time,
                    "num_sources": 0
                }

            # Step 2: Build context from retrieved documents
            context_parts = []
            sources = []

            for i, doc in enumerate(results, 1):
                metadata = doc.get('metadata', {})
                text = doc['document']
                timestamp = metadata.get('timestamp', 'Unknown')
                video = metadata.get('video_file', 'Unknown')

                context_parts.append(
                    f"[Segment {i} - Time: {timestamp} - Video: {video}]\n{text}\n"
                )

                sources.append({
                    "text": text,
                    "timestamp": timestamp,
                    "video": video,
                    "start": metadata.get('start'),
                    "end": metadata.get('end'),
                    "similarity": 1 - doc.get('distance', 0)  # Convert distance to similarity
                })

            context = "\n".join(context_parts)

            # Step 3: Get LLM response from Ollama
            prompt = self._build_prompt(question, context)

            try:
                response = ollama.generate(
                    model=self.model_name,
                    prompt=prompt,
                    options={
                        "temperature": self.temperature,
                    }
                )
                answer = response['response'].strip()

            except Exception as e:
                return {
                    "answer": f"Error generating response: {str(e)}. Make sure Ollama is running with 'ollama serve'",
                    "sources": sources,
                    "response_time": time.time() - start_time,
                    "num_sources": len(sources)
                }

            response_time = time.time() - start_time

            return {
                "answer": answer,
                "sources": sources,
                "response_time": round(response_time, 2),
                "num_sources": len(sources)
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "answer": f"Error querying system: {str(e)}",
                "sources": [],
                "response_time": time.time() - start_time,
                "num_sources": 0
            }

    def get_stats(self) -> Dict:
        """Get RAG system statistics"""
        try:
            # Get document count from ChromaDB
            count = self.vector_store.collection.count()

            return {
                "status": "healthy",
                "documents_indexed": count,
                "embedding_model": self.embedding_gen.model_name,
                "llm_model": self.model_name,
                "vector_store": "ChromaDB",
                "retrieval_top_k": self.top_k
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }


# Global instance (initialized once)
_rag_service: Optional[LectureRAGService] = None


def get_rag_service() -> LectureRAGService:
    """Get or create the RAG service singleton"""
    global _rag_service
    if _rag_service is None:
        _rag_service = LectureRAGService()
    return _rag_service
