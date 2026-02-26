#!/usr/bin/env python3
"""
Generate embeddings from transcription files and store in vector database.
This script takes transcription JSON files and creates searchable embeddings.
"""
import sys
import json
from pathlib import Path
from typing import List, Dict

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from services.embeddings.embedding_generator import EmbeddingGenerator
from services.embeddings.vector_store import VectorStore


def load_transcription(json_file: str) -> Dict:
    """Load transcription data from JSON file."""
    with open(json_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def create_chunks(
    segments: List[Dict],
    chunk_size: int = 3
) -> tuple[List[str], List[Dict]]:
    """
    Create text chunks from transcription segments.

    Args:
        segments: List of transcription segments
        chunk_size: Number of segments to combine per chunk

    Returns:
        Tuple of (chunks, chunk_metadatas)
    """
    chunks = []
    chunk_metadatas = []

    for i in range(0, len(segments), chunk_size):
        chunk_segments = segments[i:i + chunk_size]

        # Combine segment texts
        chunk_text = " ".join(seg['text'] for seg in chunk_segments)

        # Create metadata
        start_time = chunk_segments[0]['start']
        end_time = chunk_segments[-1]['end']

        chunks.append(chunk_text)
        chunk_metadatas.append({
            "start": start_time,
            "end": end_time,
            "timestamp": format_timestamp(start_time, end_time),
            "segment_ids": ",".join(str(seg['id']) for seg in chunk_segments),  # Convert list to comma-separated string
            "chunk_id": i // chunk_size
        })

    return chunks, chunk_metadatas


def format_timestamp(start: float, end: float) -> str:
    """Format start and end times as readable timestamp."""
    def to_time(seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    return f"{to_time(start)} - {to_time(end)}"


def generate_embeddings(
    json_file: str,
    embedding_model: str = "all-MiniLM-L6-v2",
    chunk_size: int = 3,
    collection_name: str = "video_transcriptions",
    persist_dir: str = "data/faiss_db"
):
    """
    Generate embeddings from transcription JSON and store in vector database.

    Args:
        json_file: Path to transcription JSON file
        embedding_model: Sentence-transformer model name
        chunk_size: Number of segments per chunk
        collection_name: ChromaDB collection name
        persist_dir: Directory for vector database

    Returns:
        Dictionary with embedding info
    """
    json_path = Path(json_file)

    if not json_path.exists():
        raise FileNotFoundError(f"Transcription file not found: {json_file}")

    print(f"\n{'='*60}")
    print(f"Generating embeddings from: {json_path.name}")
    print(f"{'='*60}\n")

    # Step 1: Load transcription
    print("Step 1: Loading transcription data...")
    transcription = load_transcription(json_file)

    video_file = transcription.get('video_file', 'unknown')
    language = transcription.get('language', 'unknown')
    segments = transcription.get('segments', [])

    print(f"  - Video: {video_file}")
    print(f"  - Language: {language}")
    print(f"  - Segments: {len(segments)}")

    # Step 2: Create chunks
    print(f"\nStep 2: Creating text chunks (chunk_size={chunk_size})...")
    chunks, chunk_metadatas = create_chunks(segments, chunk_size)

    # Add video file to all metadata
    for metadata in chunk_metadatas:
        metadata['video_file'] = video_file
        metadata['language'] = language
        metadata['source_file'] = json_path.name

    print(f"  - Created {len(chunks)} chunks")

    # Display sample chunk
    if chunks:
        print(f"\n  Sample chunk:")
        print(f"    Time: {chunk_metadatas[0]['timestamp']}")
        print(f"    Text: {chunks[0][:100]}...")

    # Step 3: Generate embeddings
    print(f"\nStep 3: Generating embeddings with {embedding_model}...")
    embedding_gen = EmbeddingGenerator(model_name=embedding_model)
    embeddings = embedding_gen.generate_embeddings(chunks)

    print(f"  - Generated {len(embeddings)} embeddings")
    print(f"  - Embedding dimension: {embeddings.shape[1]}")

    # Step 4: Store in vector database (both custom and LangChain format)
    print(f"\nStep 4: Storing in vector database...")
    vector_store = VectorStore(
        persist_directory=persist_dir,
        collection_name=collection_name
    )

    # Generate unique IDs
    base_id = json_path.stem.replace("_segments", "").replace(" ", "_")
    ids = [f"{base_id}_chunk_{i}" for i in range(len(chunks))]

    # Store in custom FAISS database
    vector_store.add_documents(
        documents=chunks,
        embeddings=embeddings.tolist(),
        metadatas=chunk_metadatas,
        ids=ids
    )

    # Also save in LangChain FAISS format for the RAG query system
    print(f"\nStep 5: Saving LangChain FAISS index...")
    from langchain_community.vectorstores import FAISS as LangchainFAISS
    from langchain_community.embeddings import HuggingFaceEmbeddings

    lc_embeddings = HuggingFaceEmbeddings(
        model_name=embedding_model,
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

    texts_with_meta = list(zip(chunks, chunk_metadatas))
    lc_store = LangchainFAISS.from_texts(
        texts=[t for t, _ in texts_with_meta],
        embedding=lc_embeddings,
        metadatas=[m for _, m in texts_with_meta]
    )
    lc_store.save_local(persist_dir)
    print(f"  LangChain FAISS index saved to {persist_dir}")

    print(f"\n{'='*60}")
    print("Embedding generation complete!")
    print(f"{'='*60}")
    print(f"\nVector database now contains {vector_store.get_count()} documents")

    result = {
        "source_file": str(json_file),
        "video_file": video_file,
        "num_segments": len(segments),
        "num_chunks": len(chunks),
        "num_embeddings": len(embeddings),
        "embedding_dim": int(embeddings.shape[1]),
        "collection_name": collection_name,
        "persist_dir": persist_dir
    }

    print("\n🔍 Next step: Query your videos using:")
    print("   python query_rag.py")

    return result


def batch_generate_embeddings(
    transcription_dir: str,
    embedding_model: str = "all-MiniLM-L6-v2",
    chunk_size: int = 3,
    collection_name: str = "video_transcriptions",
    persist_dir: str = "data/faiss_db"
):
    """
    Generate embeddings for all transcription files in a directory.

    Args:
        transcription_dir: Directory containing transcription JSON files
        embedding_model: Sentence-transformer model name
        chunk_size: Number of segments per chunk
        collection_name: ChromaDB collection name
        persist_dir: Directory for vector database

    Returns:
        List of results for each file
    """
    transcription_path = Path(transcription_dir)
    json_files = list(transcription_path.glob("*_segments.json"))

    if not json_files:
        print(f"No transcription files found in {transcription_dir}")
        return []

    print(f"\n{'='*60}")
    print(f"Found {len(json_files)} transcription files")
    print(f"{'='*60}\n")

    results = []
    for i, json_file in enumerate(json_files, 1):
        print(f"\n[{i}/{len(json_files)}] Processing {json_file.name}")
        try:
            result = generate_embeddings(
                json_file=str(json_file),
                embedding_model=embedding_model,
                chunk_size=chunk_size,
                collection_name=collection_name,
                persist_dir=persist_dir
            )
            results.append(result)
        except Exception as e:
            print(f"Error processing {json_file.name}: {e}")
            continue

    print(f"\n\n{'='*60}")
    print(f"Batch processing complete!")
    print(f"{'='*60}")
    print(f"Processed {len(results)} files successfully")

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate embeddings from transcription files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate embeddings from a single transcription
  python generate_embeddings.py "transcriptions/video_segments.json"

  # Use a different embedding model
  python generate_embeddings.py "transcriptions/video_segments.json" \\
    --embedding-model all-mpnet-base-v2

  # Adjust chunk size
  python generate_embeddings.py "transcriptions/video_segments.json" \\
    --chunk-size 5

  # Process all transcriptions in a directory
  python generate_embeddings.py --batch transcriptions/

  # Use custom collection name
  python generate_embeddings.py "transcriptions/video_segments.json" \\
    --collection-name my_videos
        """
    )

    parser.add_argument(
        "json_file",
        nargs="?",
        help="Path to transcription JSON file"
    )
    parser.add_argument(
        "--batch",
        metavar="DIR",
        help="Process all transcription files in directory"
    )
    parser.add_argument(
        "--embedding-model",
        default="all-MiniLM-L6-v2",
        help="Sentence-transformer model (default: all-MiniLM-L6-v2)"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=3,
        help="Number of segments per chunk (default: 3)"
    )
    parser.add_argument(
        "--collection-name",
        default="video_transcriptions",
        help="ChromaDB collection name (default: video_transcriptions)"
    )
    parser.add_argument(
        "--persist-dir",
        default="data/chroma_db",
        help="Vector database directory (default: chroma_db)"
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.json_file and not args.batch:
        parser.error("Either provide a JSON file or use --batch with a directory")

    if args.batch:
        # Batch mode
        results = batch_generate_embeddings(
            transcription_dir=args.batch,
            embedding_model=args.embedding_model,
            chunk_size=args.chunk_size,
            collection_name=args.collection_name,
            persist_dir=args.persist_dir
        )
        print("\n\n📊 Batch Summary:")
        print(json.dumps(results, indent=2))
    else:
        # Single file mode
        result = generate_embeddings(
            json_file=args.json_file,
            embedding_model=args.embedding_model,
            chunk_size=args.chunk_size,
            collection_name=args.collection_name,
            persist_dir=args.persist_dir
        )
        print("\n\n📊 Summary:")
        print(json.dumps(result, indent=2))
