"""Vector storage using ChromaDB."""
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Optional
from pathlib import Path


class VectorStore:
    def __init__(self, persist_directory: str = "chroma_db",
                 collection_name: str = "video_transcriptions"):
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(exist_ok=True)

        print(f"Initializing ChromaDB at {persist_directory}...")

        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=str(self.persist_directory)
        ))

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        self.collection_name = collection_name
        print(f"Collection '{collection_name}' ready. Current items: {self.collection.count()}")

    def add_documents(self, documents: List[str], embeddings: List[List[float]],
                     metadatas: Optional[List[Dict]] = None,
                     ids: Optional[List[str]] = None):
        if ids is None:
            start_id = self.collection.count()
            ids = [f"doc_{start_id + i}" for i in range(len(documents))]

        if metadatas is None:
            metadatas = [{} for _ in documents]

        print(f"Adding {len(documents)} documents to vector store...")

        self.collection.add(
            documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids
        )

        print(f"Documents added. Total items in collection: {self.collection.count()}")

    def query(self, query_embeddings: List[List[float]], n_results: int = 5,
             where: Optional[Dict] = None) -> Dict:
        return self.collection.query(
            query_embeddings=query_embeddings, n_results=n_results, where=where
        )

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

    def delete_collection(self):
        self.client.delete_collection(name=self.collection_name)
        print(f"Collection '{self.collection_name}' deleted")

    def get_count(self) -> int:
        return self.collection.count()
