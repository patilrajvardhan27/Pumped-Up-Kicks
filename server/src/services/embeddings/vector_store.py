"""Vector storage using FAISS."""
import faiss
import json
import numpy as np
from typing import List, Dict, Optional
from pathlib import Path


class VectorStore:
    def __init__(self, persist_directory: str = "faiss_db",
                 collection_name: str = "video_transcriptions"):
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(exist_ok=True, parents=True)
        self.collection_name = collection_name

        self.index_path = self.persist_directory / f"{collection_name}.index"
        self.meta_path = self.persist_directory / f"{collection_name}_meta.json"

        self.index = None
        self.documents: List[str] = []
        self.metadatas: List[Dict] = []
        self.ids: List[str] = []

        self._load()

        print(f"FAISS vector store ready at {persist_directory}. Current items: {self.get_count()}")

    def _load(self):
        if self.index_path.exists() and self.meta_path.exists():
            print(f"Loading existing FAISS index from {self.persist_directory}...")
            self.index = faiss.read_index(str(self.index_path))
            with open(self.meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            self.documents = meta.get("documents", [])
            self.metadatas = meta.get("metadatas", [])
            self.ids = meta.get("ids", [])

    def _save(self):
        faiss.write_index(self.index, str(self.index_path))
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump({
                "documents": self.documents,
                "metadatas": self.metadatas,
                "ids": self.ids
            }, f, ensure_ascii=False)

    def add_documents(self, documents: List[str], embeddings: List[List[float]],
                     metadatas: Optional[List[Dict]] = None,
                     ids: Optional[List[str]] = None):
        if ids is None:
            start_id = self.get_count()
            ids = [f"doc_{start_id + i}" for i in range(len(documents))]

        if metadatas is None:
            metadatas = [{} for _ in documents]

        print(f"Adding {len(documents)} documents to vector store...")

        embeddings_np = np.array(embeddings, dtype=np.float32)
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings_np)

        if self.index is None:
            dim = embeddings_np.shape[1]
            self.index = faiss.IndexFlatIP(dim)

        self.index.add(embeddings_np)
        self.documents.extend(documents)
        self.metadatas.extend(metadatas)
        self.ids.extend(ids)

        self._save()
        print(f"Documents added. Total items: {self.get_count()}")

    def query(self, query_embeddings: List[List[float]], n_results: int = 5,
             where: Optional[Dict] = None) -> Dict:
        if self.index is None or self.index.ntotal == 0:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]], "ids": [[]]}

        query_np = np.array(query_embeddings, dtype=np.float32)
        faiss.normalize_L2(query_np)

        n_results = min(n_results, self.index.ntotal)
        scores, indices = self.index.search(query_np, n_results)

        result_docs = []
        result_metas = []
        result_distances = []
        result_ids = []

        for idx, score in zip(indices[0], scores[0]):
            if idx == -1:
                continue
            # Apply where filter if provided
            if where:
                meta = self.metadatas[idx]
                if not all(meta.get(k) == v for k, v in where.items()):
                    continue
            result_docs.append(self.documents[idx])
            result_metas.append(self.metadatas[idx])
            result_distances.append(float(1 - score))  # Convert similarity to distance
            result_ids.append(self.ids[idx])

        return {
            "documents": [result_docs],
            "metadatas": [result_metas],
            "distances": [result_distances],
            "ids": [result_ids]
        }

    def search(self, query_text: str, embedding_generator, n_results: int = 5,
              where: Optional[Dict] = None) -> List[Dict]:
        query_embedding = embedding_generator.generate_embedding(query_text)

        results = self.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=n_results,
            where=where
        )

        formatted_results = []
        if results['documents'] and len(results['documents']) > 0:
            for i in range(len(results['documents'][0])):
                formatted_results.append({
                    'document': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i],
                    'id': results['ids'][0][i]
                })

        return formatted_results

    def delete_by_metadata(self, key: str, value: str):
        """Remove all entries where metadata[key] == value, then rebuild the index."""
        if self.index is None or self.index.ntotal == 0:
            return 0

        keep = [i for i, m in enumerate(self.metadatas) if m.get(key) != value]
        removed = self.index.ntotal - len(keep)

        if removed == 0:
            return 0

        if len(keep) == 0:
            self.delete_collection()
            return removed

        # Rebuild index with kept entries
        embeddings = np.array([self.index.reconstruct(i) for i in keep], dtype=np.float32)
        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings)

        self.documents = [self.documents[i] for i in keep]
        self.metadatas = [self.metadatas[i] for i in keep]
        self.ids = [self.ids[i] for i in keep]
        self._save()

        print(f"Removed {removed} entries with {key}={value}. Remaining: {self.get_count()}")
        return removed

    def delete_collection(self):
        if self.index_path.exists():
            self.index_path.unlink()
        if self.meta_path.exists():
            self.meta_path.unlink()
        self.index = None
        self.documents = []
        self.metadatas = []
        self.ids = []
        print(f"Collection '{self.collection_name}' deleted")

    def get_count(self) -> int:
        return self.index.ntotal if self.index else 0
