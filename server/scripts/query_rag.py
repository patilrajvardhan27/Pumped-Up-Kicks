#!/usr/bin/env python3
import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import api.compat

sys.path.append(str(Path(__file__).parent.parent / "src"))

from services.embeddings.embedding_generator import EmbeddingGenerator
from services.embeddings.vector_store import VectorStore
from services.rag.rag_pipeline import RAGPipeline
import ollama

def query_rag(question: str, num_results: int = 5, json_output: bool = False):
    embedding_gen = EmbeddingGenerator()
    vector_store = VectorStore(persist_directory="data/chroma_db")
    rag = RAGPipeline(embedding_gen, vector_store)

    results = rag.retrieve(query=question, n_results=num_results)

    if not results:
        output = {
            "answer": "No relevant information found in the lectures. Please upload and process lecture videos first.",
            "sources": []
        }
        if json_output:
            print(json.dumps(output))
        else:
            print(output["answer"])
        return

    context_parts = []
    sources = []

    for i, doc in enumerate(results, 1):
        metadata = doc.get('metadata', {})
        text = doc['document']
        timestamp = metadata.get('timestamp', 'Unknown')
        video = metadata.get('video_file', 'Unknown')

        context_parts.append(f"[Segment {i} - Time: {timestamp} - Video: {video}]\n{text}\n")

        sources.append({
            "text": text,
            "timestamp": timestamp,
            "video": video,
            "start": metadata.get('start'),
            "end": metadata.get('end'),
            "similarity": 1 - doc.get('distance', 0)
        })

    context = "\n".join(context_parts)

    prompt = f"""You are a helpful AI teaching assistant helping students understand lecture content.

Use the lecture context below to answer the student's question accurately.
Always cite specific timestamps when referencing parts of the lecture.

Lecture Context:
{context}

Question: {question}

Answer (with timestamp citations):"""

    try:
        response = ollama.generate(
            model="llama3.2:3b",
            prompt=prompt,
            options={"temperature": 0.2}
        )
        answer = response['response'].strip()
    except Exception as e:
        answer = f"Error generating response: {str(e)}"

    output = {
        "answer": answer,
        "sources": sources
    }

    if json_output:
        print(json.dumps(output, indent=2))
    else:
        print("\nAnswer:")
        print(answer)
        print(f"\nSources: {len(sources)} segments")
        for i, source in enumerate(sources, 1):
            print(f"\n{i}. {source['video']} at {source['timestamp']}")

def get_stats():
    try:
        embedding_gen = EmbeddingGenerator()
        vector_store = VectorStore(persist_directory="data/chroma_db")
        count = vector_store.collection.count()

        stats = {
            "status": "healthy",
            "documents_indexed": count,
            "embedding_model": embedding_gen.model_name,
            "llm_model": "llama3.2:3b",
            "vector_store": "ChromaDB"
        }
        print(json.dumps(stats, indent=2))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", type=str, help="Question to ask")
    parser.add_argument("--num-results", type=int, default=5)
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--stats", action="store_true", help="Show system stats")

    args = parser.parse_args()

    if args.stats:
        get_stats()
    elif args.query:
        query_rag(args.query, args.num_results, args.json)
    else:
        while True:
            question = input("\nQuery (or 'exit'): ")
            if question.lower() in ['exit', 'quit']:
                break
            query_rag(question, args.num_results, args.json)
