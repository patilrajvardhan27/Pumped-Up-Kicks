# Architecture and design record

Prices and offers were checked on 6 October 2026 against the sources in section 10. Figures marked **(estimate)** are arithmetic from those prices and should be measured before being relied on. Each section says whether it describes something **implemented** or **proposed**.

## 1. Decisions

1. **No Kubernetes at this scale.** A managed container platform gives the same result for less operating effort (section 6).
2. **Retrieval quality is the highest-value work.** The retrieval pipeline has no recall measurement, so any change to it is a guess. An evaluation set comes first; later work is justified or dropped by that number. Status: proposed.
3. **Single-lecture questions may not need retrieval.** Whole-lecture questions ("summarise the main argument", "list every example") cannot be answered from the top 5 chunks. For one lecture, sending the whole transcript with prompt caching is the alternative (section 3). Status: proposed.
4. **The largest risk is not technical.** Class recordings are usually owned by the instructor or school and contain other people's voices (section 8).

## 2. Current state

| Part | Implemented | Known weakness |
|---|---|---|
| Transcription | Local Whisper in a subprocess, or faster-whisper on a Modal A10G | Jobs run in FastAPI `BackgroundTasks`: a restart strands a lecture mid-stage. No retries. |
| Chunking | 75 s windows, 18 s overlap (`indexer.py`) | About 190 spoken words per chunk, close to the 256-token limit of the embedding model, so some chunk tails may be truncated. Boundaries ignore topic changes. |
| Embeddings | all-MiniLM-L6-v2, 384 dimensions, fastembed (ONNX) | Small, English-centred, dense only. |
| Retrieval | Dense cosine search, top 5, HNSW, filtered by user and scope inside the query | No keyword signal in chat, no reranker. |
| Search | Postgres full-text search over chunk text (`GET /api/search`), expression-indexed | Separate from chat retrieval. |
| Answering | One shot with excerpts only, a `NOT_COVERED` marker for off-topic questions, per-message cost, answer cache | No prompt caching (`cache_control` is not set). |
| Study tools | Study guide per lecture, practice questions and flashcards, with citation checks | |
| Isolation | Every query filters `user_id` explicitly; tests cover cross-tenant access | No database-level backstop. |
| Rate limits | Per user, in memory (`ratelimit.py`) | Counted per process, so they multiply across replicas. |
| Quality checks | `evals/` checks transcripts for gaps, repeats and truncation | No retrieval recall or answer faithfulness measurement yet. |

Kept on purpose: Postgres with pgvector (one database, transactional with metadata), Clerk for auth, object storage with presigned URLs, a single module that calls Claude (`claude_client.py`), and per-message cost accounting.

## 3. Long context versus retrieval (proposed)

A lecture hour is about 9,000 words, roughly 12,000 tokens **(estimate: 150 words a minute, 1.3 tokens a word)**. A 40-hour course is about 480,000 tokens.

Using the price table in `claude_client.py` ($3 per million input tokens, $15 per million output, cache reads about 0.1x, cache writes about 1.25x) **(estimate)**:

| One question on one lecture | Input tokens | Cost |
|---|---|---|
| Retrieval, top 20 chunks of about 250 tokens, 400-token answer | about 5,500 | about $0.022 |
| Whole transcript, first question (cache write) | 12,000 | about $0.045 plus $0.006 output |
| Whole transcript, later questions inside the cache window | 12,000 read at 0.1x | about $0.004 plus $0.006 output |

From the third question in a study session, the full transcript is cheaper than retrieval, and it can answer coverage and synthesis questions that retrieval structurally cannot. Retrieval earns its place across a library too large to fit. The proposed router:

- One lecture selected and the transcript under the context budget: long context with prompt caching.
- Whole library, or a lecture too long: hybrid retrieval, rerank, then the agent loop in section 5.

To verify before building: the model's current context limit, the cache time-to-live, and answer quality on long inputs, all on the evaluation set.

## 4. Retrieval design (proposed)

**Chunking.** Replace fixed windows with boundaries at topic changes (embedding-similarity valleys, TextTiling style), keeping a small overlap. Give each chunk a one-sentence context written by a cheap model, embedded and keyword-indexed with the chunk. Anthropic reports that contextual embeddings cut top-20 retrieval failures by 35% (5.7% to 3.7%), contextual keyword search by 49% (to 2.9%), and adding a reranker by 67% (to 1.9%), at about $1.02 per million document tokens with caching, or about $0.012 per lecture hour **(estimate)**. These are Anthropic's datasets; the evaluation set must confirm them here.

**Embedding model.** Candidates are BGE-M3, Qwen3-Embedding, Nomic Embed v2, or a hosted API. Leaderboards are not the lectures, so the procedure is: generate 200 to 300 (question, lecture, timestamp) triples with Claude and hand-verify at least 50; score every candidate, including the current MiniLM, on recall@5, recall@20 and MRR; pick the cheapest that clears the bar. Fine-tuning comes only if the evaluation shows retrieval is the bottleneck.

**Vector store.** Stay on pgvector until roughly 10 to 50 million vectors or heavy filtered ANN load. Filtered HNSW can return too few rows because the `user_id` filter applies after the index returns its candidates. pgvector 0.8 added iterative index scans (`hnsw.iterative_scan`); enable and test it with many tenants. The code does not set it today.

**Hybrid search and rerank.** Fuse dense results with Postgres full-text results by reciprocal rank fusion, then rerank the top 50 with a cross-encoder and pass the best 20 to the model. The full-text index already exists for `/api/search`.

## 5. Agent loop (proposed)

A bounded tool-using loop on the Anthropic tool-use API, in roughly 100 lines, rather than an agent framework.

- Read-only tools: `search_transcript(query, video_ids)`, `read_window(video_id, start, end)`, `get_slide_text(video_id, t)`, `list_lectures()`.
- Writes only when the user asks: study guide, quiz, flashcards, lecture comparison.
- Limits: at most 6 steps, a per-request cost ceiling tied to the quota, per-tool timeouts.
- Citation verifier: every `[mm:ss]` in an answer must fall inside a window the agent read; otherwise it is stripped or regenerated. Implemented in part for study tools, proposed for chat.
- Prompt injection: transcripts and slides are untrusted text. Tool output goes in delimited blocks, and retrieved content can never trigger a write.
- Model tiers: a small model for routing and contextualisation, a mid-tier model for answers, the top tier on request. The model id stays in config.

Ingestion would become queue-driven: each stage a job whose state lives in Postgres (`SELECT ... FOR UPDATE SKIP LOCKED`), so a crash resumes at the failed stage. Transcription would gain voice-activity detection and word-level timestamps. Slide keyframes with OCR or a vision caption would be indexed as timestamped chunks.

## 6. Hosting and Kubernetes

Kubernetes solves coordination problems (many services, many teams, bursty fleets) that this project does not have. It adds a control plane to pay for, upgrades, and networking to debug. The standard ingress controller, ingress-nginx, was retired by the Kubernetes project in March 2026; the replacement is the Gateway API.

The only workloads shaped like Kubernetes ones are the GPU and ingestion workers (queue-driven, bursty, scale to zero), and Modal already covers them. Control-plane fees start when the cluster exists: AKS has a free tier, GKE charges $0.10 an hour offset by a monthly credit, EKS charges about $73 a month.

Current hosting (implemented): Vercel for the client, Railway for the API, Neon for Postgres, Cloudflare R2 for objects, Modal for transcription, Clerk for auth. A cluster of 3 nodes with a highly available database and GPU burst is roughly $300 to $600 a month before LLM spend **(estimate)**. To learn Kubernetes without paying, write manifests and run them on `kind` or `k3d`.

## 7. Cost model

| Item | Cost | Note |
|---|---|---|
| Claude per question | about $0.01 (cached whole lecture) to $0.02 (retrieval) | Section 3 (estimate) |
| Free plan, `FREE_PLAN_MONTHLY_USD=1.00` | about 45 retrieval questions | Estimate |
| Transcription | about $0.03 to $0.04 per lecture hour | Modal, billed per second (estimate) |
| Storage | 10 GB free, then $0.015 per GB-month, no egress fee | Cloudflare R2 |

LLM answers and video storage dominate; servers barely register at small scale. Spend is summed from `messages.cost_usd` and `usage_charges` and checked before each Claude call.

## 8. Risks

1. **Copyright and privacy of recordings.** Recordings may belong to the instructor or school, may be restricted by institutional policy, and capture other voices. The terms place responsibility for upload rights on the user and give a takedown route; that does not remove the operator's exposure. Obtain a legal review before charging anyone.
2. **Wrong timestamps destroy the product.** Whisper can hallucinate on silence and drift on timing. Citation checks and word-level timestamps are the value proposition, not polish.
3. **Competition inside the platform.** Lecture-capture and learning-management vendors can ship transcript search, and a general chatbot with an uploaded transcript is free. Defensible parts: timestamp-grounded citations, search across a semester, slides, study workflows.
4. **Academic-integrity optics.** Position the product as a study tool for a student's own recordings.
5. **Vendor concentration** in Anthropic, Clerk and Modal. The single Claude module is the pattern to repeat.
6. **Runaway cost** from unbounded agent loops and very long videos. Hard caps at every layer.
7. **Fine-tuning before measuring.** A custom model where an API call works.
8. **Operating load.** Each added service multiplies on-call work. Add one only when the limit it removes can be named.

## 9. Roadmap

| Phase | Work | Exit criterion |
|---|---|---|
| 0, done | Launch checklist, security hardening, Canvas import, study tools, subjects | Lint, build, axe and 138 server tests pass |
| 1 | Evaluation harness: 200+ questions, baseline recall@5/20, MRR, citation validity | A number exists for the current pipeline |
| 2 | Hybrid search, reranker, top 20, contextual chunks, long-context router | Beats the baseline within a cost-per-question budget, else revert |
| 3 | Queue-driven ingestion, VAD and word timestamps, slide OCR | No lecture stuck in a processing state after a deploy |
| 4 | Agent loop with citation verifier | Task success and cost per task measured |
| 5 | Row-level security, deletion job, billing, Sentry, OpenTelemetry, Redis limits, CI | A test that tries to read another tenant's data fails |

Before phase 4, put the product in front of 10 students who are not friends. If they do not return in a second week, agents will not fix that.

## 10. Sources

Checked 6 October 2026. Secondary sources are marked; confirm them on the vendor's pricing page before spending.

- ingress-nginx retirement: https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/
- AKS Free and Standard tiers: https://learn.microsoft.com/azure/aks/free-standard-pricing-tiers
- EKS control-plane price (secondary): https://cloudburn.io/blog/amazon-eks-pricing
- GKE free-tier credit and fee (secondary): https://cast.ai/blog/gke-pricing-explained-how-to-choose-the-right-plan-for-you/
- Anthropic, Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Embedding model comparison (secondary, vendor blog): https://blog.premai.io/best-embedding-models-for-rag-2026-ranked-by-mteb-score-cost-and-self-hosting
- Modal pricing (figures via aggregator): https://modal.com/pricing
- Cloudflare R2 pricing (secondary): https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/
- pgvector iterative index scans: https://github.com/pgvector/pgvector (check the 0.8 release notes)
