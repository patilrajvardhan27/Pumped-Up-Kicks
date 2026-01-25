"""Text embedding generation using sentence-transformers."""
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np


class EmbeddingGenerator:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        print(f"Loading embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        self.model_name = model_name
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded. Embedding dimension: {self.embedding_dim}")

    def generate_embedding(self, text: str) -> np.ndarray:
        return self.model.encode(text, convert_to_numpy=True)

    def generate_embeddings(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        print(f"Generating embeddings for {len(texts)} texts...")
        embeddings = self.model.encode(
            texts, batch_size=batch_size, show_progress_bar=True, convert_to_numpy=True
        )
        print("Embeddings generated successfully")
        return embeddings

    def get_similarity(self, text1: str, text2: str) -> float:
        emb1 = self.generate_embedding(text1)
        emb2 = self.generate_embedding(text2)
        similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        return float(similarity)
