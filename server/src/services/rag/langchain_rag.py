"""
LangChain-powered RAG system for lecture Q&A.

Compatible with Python 3.14 using FAISS vector store.
"""
from typing import List, Dict, Optional
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_ollama import ChatOllama
from langchain_community.embeddings import HuggingFaceEmbeddings


class LectureRAG:
    """
    RAG system for lecture Q&A with LLM-powered responses.

    Features:
    - Semantic search using ChromaDB
    - LLM-powered answers using Ollama
    - Timestamp citations in responses
    - Video filtering support

    Example:
        >>> rag = LectureRAG()
        >>> result = rag.query("What is a neural network?")
        >>> print(result['answer'])
        >>> for source in result['sources']:
        ...     print(f"[{source['timestamp']}] {source['text']}")
    """

    def __init__(
        self,
        persist_dir: str = "data/faiss_db",
        model_name: str = "llama3.2:3b",
        embedding_model: str = "all-MiniLM-L6-v2",
        temperature: float = 0.2,
        top_k: int = 5
    ):
        """
        Initialize the LangChain RAG system.

        Args:
            persist_dir: Path to ChromaDB persistence directory
            model_name: Ollama model name (llama3.2:3b, mistral:7b, etc.)
            embedding_model: HuggingFace embedding model
            temperature: LLM temperature (0.0 = deterministic, 1.0 = creative)
            top_k: Number of results to retrieve from vector store
        """
        self.persist_dir = persist_dir
        self.model_name = model_name
        self.top_k = top_k
        self.chat_history = []  # Simple conversation history

        # Initialize embeddings (must match the model used during indexing)
        print(f"Loading embedding model: {embedding_model}")
        self.embeddings = HuggingFaceEmbeddings(
            model_name=embedding_model,
            model_kwargs={'device': 'cpu'},  # Use 'cuda' if GPU available
            encode_kwargs={'normalize_embeddings': True}
        )

        # Initialize vector store
        faiss_path = Path(persist_dir)
        print(f"Connecting to FAISS at: {persist_dir}")
        if (faiss_path / "index.faiss").exists():
            self.vectorstore = FAISS.load_local(
                persist_dir, self.embeddings,
                allow_dangerous_deserialization=True
            )
            print(f"✓ FAISS loaded: {self.vectorstore.index.ntotal} documents indexed")
        else:
            self.vectorstore = None
            print("⚠ No FAISS index found yet. Upload and process a video first.")

        # Initialize LLM via Ollama
        print(f"Connecting to Ollama model: {model_name}")
        self.llm = ChatOllama(
            model=model_name,
            temperature=temperature,
            base_url="http://localhost:11434"  # Default Ollama URL
        )

        print("✓ LangChain RAG system ready!\n")

    def _build_prompt(self, question: str, context: str) -> str:
        """Build the prompt with context and question."""
        prompt = f"""You are a helpful AI teaching assistant helping students understand lecture content.

Use the lecture context below to answer the student's question accurately.
If you cannot find the answer in the provided context, clearly say so - don't make up information.

IMPORTANT: Always cite specific timestamps when referencing parts of the lecture.

Lecture Context:
{context}

Question: {question}

Answer (with timestamp citations):"""
        return prompt

    def query(
        self,
        question: str,
        video_filter: Optional[str] = None,
        top_k: Optional[int] = None
    ) -> Dict:
        """
        Query the lecture content with optional filtering.

        Args:
            question: User's question about the lectures
            video_filter: Optional filename to filter results by specific video
            top_k: Optional override for number of results to retrieve

        Returns:
            Dictionary with:
            - answer: LLM-generated response
            - sources: List of source documents with timestamps

        Example:
            >>> result = rag.query("Explain backpropagation")
            >>> result = rag.query("What was said about CNNs?",
            ...                    video_filter="lecture_01.mp4")
        """
        k = top_k or self.top_k

        # Retrieve relevant documents
        print(f"\nProcessing query: '{question}'")
        try:
            if self.vectorstore is None:
                return {
                    "answer": "No videos have been processed yet. Please upload and process a video first.",
                    "sources": []
                }

            if video_filter:
                print(f"Filtering by video: {video_filter}")
                docs = self.vectorstore.similarity_search(
                    question,
                    k=k,
                    filter={"video_file": video_filter}
                )
            else:
                docs = self.vectorstore.similarity_search(question, k=k)

            if not docs:
                return {
                    "answer": "No relevant information found in the lectures.",
                    "sources": []
                }

            print(f"✓ Retrieved {len(docs)} relevant segments")

            # Build context from retrieved documents
            context_parts = []
            sources = []

            for i, doc in enumerate(docs, 1):
                timestamp = doc.metadata.get("timestamp", "Unknown")
                video = doc.metadata.get("video_file", "Unknown")
                text = doc.page_content

                context_parts.append(f"[Segment {i} - Time: {timestamp} - Video: {video}]\n{text}\n")

                sources.append({
                    "text": text,
                    "timestamp": timestamp,
                    "video": video,
                    "start": doc.metadata.get("start"),
                    "end": doc.metadata.get("end")
                })

            context = "\n".join(context_parts)

            # Build prompt and get LLM response
            prompt = self._build_prompt(question, context)

            try:
                answer = self.llm.invoke(prompt)
                # Extract content from AIMessage object
                answer_text = answer.content if hasattr(answer, 'content') else str(answer)
            except Exception as e:
                return {
                    "answer": f"Error: {str(e)}. Make sure Ollama is running with 'ollama serve'",
                    "sources": sources
                }

            # Store in chat history
            self.chat_history.append({
                "question": question,
                "answer": answer_text,
                "sources": sources
            })

            return {
                "answer": answer_text,
                "sources": sources
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "answer": f"Error querying system: {str(e)}",
                "sources": []
            }

    def clear_history(self):
        """Clear conversation memory (resets context for new conversation)."""
        self.chat_history = []
        print("Conversation history cleared")

    def get_stats(self) -> Dict:
        """Get statistics about the RAG system."""
        try:
            doc_count = self.vectorstore.index.ntotal if self.vectorstore else 0
            return {
                "documents_indexed": doc_count,
                "embedding_model": self.embeddings.model_name,
                "llm_model": self.model_name,
                "persist_directory": self.persist_dir,
                "retrieval_top_k": self.top_k,
                "conversation_turns": len(self.chat_history)
            }
        except Exception as e:
            return {"error": str(e)}


def main():
    """
    Demo/test function for the LangChain RAG system.

    Run with: python -m src.services.rag.langchain_rag
    """
    import sys

    print("=" * 70)
    print("PUMPED UP KICKS - LangChain RAG System")
    print("=" * 70)

    # Initialize RAG system
    try:
        rag = LectureRAG(
            persist_dir="data/chroma_db",
            model_name="llama3.2:3b",
            embedding_model="all-MiniLM-L6-v2"
        )
    except Exception as e:
        print(f"\n❌ Error initializing RAG system: {e}")
        print("\nMake sure:")
        print("1. ChromaDB has indexed documents (run generate_embeddings.py)")
        print("2. Ollama is running: ollama serve")
        print("3. Model is downloaded: ollama pull llama3.2:3b")
        sys.exit(1)

    # Print stats
    stats = rag.get_stats()
    print("\n📊 System Stats:")
    for key, value in stats.items():
        print(f"  • {key}: {value}")

    # Interactive query loop
    print("\n" + "=" * 70)
    print("Ask questions about your lectures!")
    print("Type 'exit', 'quit', or press Ctrl+C to stop")
    print("Type 'clear' to clear conversation history")
    print("=" * 70 + "\n")

    try:
        while True:
            # Get user input
            question = input("\n🎓 Question: ").strip()

            if not question:
                continue

            # Check for commands
            if question.lower() in ['exit', 'quit', 'q']:
                print("\nGoodbye! 👋")
                break

            if question.lower() == 'clear':
                rag.clear_history()
                continue

            # Query the system
            print("\n🤖 Thinking...")
            result = rag.query(question)

            # Display answer
            print("\n" + "─" * 70)
            print("💡 Answer:")
            print("─" * 70)
            print(result['answer'])

            # Display sources
            if result['sources']:
                print("\n" + "─" * 70)
                print(f"📚 Sources ({len(result['sources'])} segments):")
                print("─" * 70)
                for i, source in enumerate(result['sources'], 1):
                    print(f"\n[{i}] Timestamp: {source['timestamp']}")
                    print(f"    Video: {source['video']}")
                    print(f"    Text: {source['text'][:200]}...")

    except KeyboardInterrupt:
        print("\n\nInterrupted. Goodbye! 👋")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
