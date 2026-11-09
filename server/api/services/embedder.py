"""
Text embeddings via fastembed (ONNX).

Replaces sentence-transformers, which pulled in PyTorch: a ~2.5 GB image and
~1 GB resident just to embed one short question per query. Same
all-MiniLM-L6-v2 weights, ~200 MB resident, so the API container fits the
cheapest tier and deploys in seconds.

Vectors come back L2-normalised, which is what pgvector's cosine operator wants.
"""
from typing import Iterable, List

import numpy as np

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


class Embedder:
    """Lazily-loaded embedding model. One instance per process."""

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name
        self.embedding_dim = EMBEDDING_DIM
        self._model = None

    @property
    def model(self):
        if self._model is None:
            from fastembed import TextEmbedding

            print(f"[Embeddings] Loading {self.model_name} (onnx)...")
            self._model = TextEmbedding(model_name=self.model_name)
            print("[Embeddings] Ready")
        return self._model

    def embed_one(self, text: str) -> List[float]:
        return next(iter(self.model.embed([text]))).tolist()

    def embed_many(self, texts: Iterable[str], batch_size: int = 64) -> List[List[float]]:
        texts = list(texts)
        if not texts:
            return []
        vectors = self.model.embed(texts, batch_size=batch_size)
        return [np.asarray(v).tolist() for v in vectors]


_embedder: Embedder | None = None


def get_embedder(model_name: str = DEFAULT_MODEL) -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = Embedder(model_name)
    return _embedder
