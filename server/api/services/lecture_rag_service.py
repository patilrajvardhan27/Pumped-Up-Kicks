import json
import ollama
import time
from pathlib import Path
from typing import Dict, List, Optional
from difflib import SequenceMatcher

class LectureRAGService:
    def __init__(
        self,
        model_name: str = "llama3.2:3b",
        temperature: float = 0.2
    ):
        self.model_name = model_name
        self.temperature = temperature
        self.server_dir = Path(__file__).parent.parent.parent
        self.transcriptions_dir = self.server_dir / "data" / "transcriptions"
        print(f"[Lecture RAG] Initialized with model: {model_name}")

    def load_all_segments(self) -> List[Dict]:
        segments = []
        if not self.transcriptions_dir.exists():
            return segments

        for segments_file in self.transcriptions_dir.glob("*_segments.json"):
            try:
                with open(segments_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    video_name = segments_file.stem.replace('_segments', '')

                    for seg in data.get('segments', []):
                        segments.append({
                            'text': seg.get('text', ''),
                            'start': seg.get('start', 0),
                            'end': seg.get('end', 0),
                            'video': video_name,
                            'timestamp': self.format_timestamp(seg.get('start', 0))
                        })
            except Exception as e:
                print(f"Error loading {segments_file}: {e}")

        return segments

    def format_timestamp(self, seconds: float) -> str:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"

    def search_segments(self, query: str, segments: List[Dict], top_k: int = 5) -> List[Dict]:
        query_lower = query.lower()
        scored_segments = []

        for seg in segments:
            text_lower = seg['text'].lower()

            score = SequenceMatcher(None, query_lower, text_lower).ratio()

            if query_lower in text_lower:
                score += 0.5

            for word in query_lower.split():
                if len(word) > 3 and word in text_lower:
                    score += 0.2

            scored_segments.append((score, seg))

        scored_segments.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, seg in scored_segments[:top_k]:
            if score > 0.1:
                results.append({
                    **seg,
                    'similarity': min(score, 1.0)
                })

        return results

    def query(
        self,
        question: str,
        video_filter: Optional[str] = None,
        top_k: int = 5
    ) -> Dict:
        start_time = time.time()

        try:
            all_segments = self.load_all_segments()

            if not all_segments:
                response = ollama.generate(
                    model=self.model_name,
                    prompt=f"""You are a helpful AI teaching assistant.

Question: {question}

Please answer helpfully. Note: No lecture content has been uploaded yet, so you're providing general knowledge.

Answer:""",
                    options={"temperature": self.temperature}
                )

                return {
                    "answer": response['response'].strip(),
                    "sources": [],
                    "response_time": round(time.time() - start_time, 2),
                    "num_sources": 0
                }

            relevant_segments = self.search_segments(question, all_segments, top_k)

            if not relevant_segments:
                response = ollama.generate(
                    model=self.model_name,
                    prompt=f"""You are a helpful AI teaching assistant.

Question: {question}

No relevant lecture content was found for this question. Please provide a general answer.

Answer:""",
                    options={"temperature": self.temperature}
                )

                return {
                    "answer": response['response'].strip(),
                    "sources": [],
                    "response_time": round(time.time() - start_time, 2),
                    "num_sources": 0
                }

            context_parts = []
            sources = []

            for i, seg in enumerate(relevant_segments, 1):
                context_parts.append(
                    f"[Segment {i} - Time: {seg['timestamp']} - Video: {seg['video']}]\n{seg['text']}\n"
                )

                sources.append({
                    "text": seg['text'],
                    "timestamp": seg['timestamp'],
                    "video": seg['video'],
                    "start": seg['start'],
                    "end": seg['end'],
                    "similarity": seg['similarity']
                })

            context = "\n".join(context_parts)

            prompt = f"""You are a helpful AI teaching assistant helping students understand lecture content.

Use the lecture context below to answer the student's question accurately and completely.
Important guidelines:
- Include ALL relevant points mentioned in the context, not just the first one you find.
- Always cite specific timestamps when referencing parts of the lecture.
- If the lecture lists multiple reasons, limitations, or examples, list all of them.
- Be thorough but concise.

Lecture Context:
{context}

Question: {question}

Answer (comprehensive, with timestamp citations):"""

            response = ollama.generate(
                model=self.model_name,
                prompt=prompt,
                options={"temperature": self.temperature}
            )

            answer = response['response'].strip()
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
                "answer": f"Error: {str(e)}. Make sure Ollama is running.",
                "sources": [],
                "response_time": time.time() - start_time,
                "num_sources": 0
            }

    def get_stats(self) -> Dict:
        try:
            all_segments = self.load_all_segments()
            return {
                "status": "healthy",
                "documents_indexed": len(all_segments),
                "embedding_model": "SequenceMatcher (text similarity)",
                "llm_model": self.model_name,
                "vector_store": "File-based transcription segments"
            }
        except Exception as e:
            return {
                "status": "error",
                "documents_indexed": 0,
                "embedding_model": "N/A",
                "llm_model": self.model_name,
                "vector_store": "N/A",
                "error": str(e)
            }

_rag_service: Optional[LectureRAGService] = None

def get_rag_service() -> LectureRAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = LectureRAGService()
    return _rag_service
