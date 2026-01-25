"""RAG pipeline for video Q&A."""
from typing import List, Dict, Optional
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent))

from services.embeddings.embedding_generator import EmbeddingGenerator
from services.embeddings.vector_store import VectorStore


class RAGPipeline:
    def __init__(self, embedding_generator: EmbeddingGenerator,
                 vector_store: VectorStore):
        self.embedding_generator = embedding_generator
        self.vector_store = vector_store

    def retrieve(self, query: str, n_results: int = 5,
                where: Optional[Dict] = None) -> List[Dict]:
        print(f"\nRetrieving documents for query: '{query}'")

        results = self.vector_store.search(
            query_text=query,
            embedding_generator=self.embedding_generator,
            n_results=n_results,
            where=where
        )

        print(f"Retrieved {len(results)} documents")
        return results

    def build_context(self, retrieved_docs: List[Dict],
                     max_context_length: int = 2000) -> str:
        context_parts = []
        current_length = 0

        for i, doc in enumerate(retrieved_docs):
            doc_text = doc['document']
            metadata = doc.get('metadata', {})

            timestamp = metadata.get('timestamp', 'Unknown')
            doc_formatted = f"[Segment {i+1} - Time: {timestamp}]\n{doc_text}\n"

            if current_length + len(doc_formatted) > max_context_length:
                break

            context_parts.append(doc_formatted)
            current_length += len(doc_formatted)

        return "\n".join(context_parts)

    def format_results(self, query: str, retrieved_docs: List[Dict]) -> str:
        output = [f"\n{'='*60}"]
        output.append(f"Query: {query}")
        output.append(f"{'='*60}\n")

        if not retrieved_docs:
            output.append("No relevant segments found.")
            return "\n".join(output)

        output.append(f"Found {len(retrieved_docs)} relevant segments:\n")

        for i, doc in enumerate(retrieved_docs, 1):
            metadata = doc.get('metadata', {})
            distance = doc.get('distance', 0)
            similarity = 1 - distance

            output.append(f"\n--- Segment {i} (Similarity: {similarity:.2%}) ---")

            if 'timestamp' in metadata:
                output.append(f"Time: {metadata['timestamp']}")
            if 'video_file' in metadata:
                output.append(f"Video: {metadata['video_file']}")

            output.append(f"\nText: {doc['document']}")
            output.append("-" * 60)

        return "\n".join(output)

    def query(self, query: str, n_results: int = 5, where: Optional[Dict] = None,
             return_context: bool = False) -> str:
        retrieved_docs = self.retrieve(query, n_results, where)

        if return_context:
            return self.build_context(retrieved_docs)
        else:
            return self.format_results(query, retrieved_docs)
