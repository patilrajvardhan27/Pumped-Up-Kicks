# RAG Service

Retrieval Augmented Generation for AI-powered question answering.

## What Goes Here

- Document retrieval logic
- Context building for LLM queries
- LLM integration (OpenAI, Anthropic, local models)
- Prompt engineering and templates
- Response generation

## RAG Pipeline

1. **Retrieval**: Find relevant content from vector database
2. **Augmentation**: Build context from retrieved documents
3. **Generation**: Send context + question to LLM for answer

## Use Cases

- Ask questions about video content
- Summarize video segments
- Extract insights from transcriptions
- Interactive chat with video content

## Files Example

- `retriever.ts` - Retrieve relevant documents
- `contextBuilder.ts` - Build context for prompts
- `llmClient.ts` - LLM API integration
- `ragPipeline.ts` - Orchestrate the RAG process
