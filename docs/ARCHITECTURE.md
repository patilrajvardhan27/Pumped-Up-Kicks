# Pumped Up Kicks: target architecture

Written 6 October 2026. Prices and offers were checked on that date from the sources in section 9; anything marked **(estimate)** is my own arithmetic and should be measured before you rely on it.

## 0. The verdict, before the diagram

1. **Do not start on Kubernetes.** At your scale it costs time and credits and buys nothing a managed container platform does not give you. Section 5 makes the case, then shows how to learn Kubernetes for about $0 without running your product on it.
2. **The highest-value work is retrieval quality, not infrastructure.** Today's pipeline has no evaluation, so every change to it is a guess. Build the eval set first (phase 1). Everything else is justified or killed by that number.
3. **The UI's own starter questions defeat the current design.** "Summarise the main argument" and "List every example worked through" are whole-lecture questions, and top-5 retrieval of 75-second chunks cannot answer them. Section 2 argues that for a single lecture you should skip retrieval and send the whole transcript with prompt caching.
4. **The biggest risk is not technical.** Recordings of classes are usually owned by the instructor or the school, and they contain other people's voices. Section 7 puts this first. I have added the terms and privacy pages, but they are not legal advice.

## 1. What exists, and where it is weak

| Part | Today | Weakness |
|---|---|---|
| Transcription | Whisper in a subprocess, or a Modal worker | In-process `BackgroundTasks`: a restart (including `uvicorn --reload`) strands a lecture on "Transcribing" forever. No retries, no resumable stages. |
| Chunking | 75 s windows, 18 s overlap (`indexer.py`) | About 190 spoken words, roughly 250 tokens: right at all-MiniLM-L6-v2's input limit, so the tail of some chunks is probably truncated before embedding. Measure it. Boundaries ignore topic changes. |
| Embeddings | `all-MiniLM-L6-v2`, 384 dimensions, fastembed (ONNX) | Small general-purpose model, English-centred, no sparse signal. |
| Retrieval | One dense cosine query, top 5, HNSW index | No keyword match (terms, names, equations), no rerank. Anthropic's own test found top-20 beat top-10 and top-5. |
| Answering | One shot, no prompt caching | The cost code already models cache pricing, but no request sets `cache_control`. |
| Quality | None | No golden set, no recall or faithfulness numbers, no tracing. |
| Isolation | Every query filters `user_id` by hand | One forgotten filter is a cross-tenant leak. No database-level backstop. |
| Rate limits | In-memory per process (added this session) | Per replica, so they multiply when you scale out. |

Kept on purpose: Postgres plus pgvector (one database, transactional with metadata, 0.8.6 installed), Clerk for auth, object storage with presigned URLs, one file that talks to Claude, per-message cost accounting. Those are good decisions.

## 2. The contrarian case: you may not need retrieval

A lecture hour is about 9,000 words, roughly 12,000 tokens **(estimate: 150 words a minute, 1.3 tokens a word)**. A 40-hour course is about 480,000 tokens.

Using the price table already in `claude_client.py` ($3 per million input tokens, $15 per million output, cached reads about 0.1x, cache writes about 1.25x) **(estimate)**:

| Approach, one question on one lecture | Input tokens | Cost |
|---|---|---|
| Retrieval, top 20 chunks (about 250 tokens each), 400-token answer | about 5,500 | about $0.022 |
| Whole transcript, first question (cache write) | 12,000 | about $0.045 + $0.006 output |
| Whole transcript, later questions inside the cache window | 12,000 read at 0.1x | about $0.004 + $0.006 output |

From the third question onward in a study session, the full transcript is cheaper than retrieval, **and it can answer questions retrieval structurally cannot**: coverage ("list every example"), synthesis, "what did the lecturer *not* cover". Retrieval earns its place only across a library too large to fit.

So the router is the first design decision:

- **One lecture selected, transcript under the context budget** -> long context with prompt caching. No embeddings involved.
- **Whole library, or a lecture too long** -> hybrid retrieval, rerank, then the agent loop below.

Caveats to verify before building: the model's current context limit, the cache time-to-live (the default is short, a longer one costs more), and quality on long inputs for your lectures. Test all three on the eval set.

## 3. Target system

```
Browser (Next.js, Motion, PostHog via /ingest)
   |  HTTPS, CSP, HSTS
   v
Edge / CDN ---> Web (Next.js)              Clerk (auth, orgs)       Stripe (usage billing)
   |
   v
API (FastAPI, stateless)  --- rate limit (Redis later) --- Postgres + pgvector (RLS on)
   |        |                                                  ^
   |        +--> Agent service (tool loop, budgets) -----------+  hybrid search + rerank
   |                    |
   |                    +--> Claude (router / answerer tiers)
   v
Queue (Postgres SKIP LOCKED first) ---> Workers (scale to zero)
                                          1 transcribe  (faster-whisper, GPU, word timestamps, VAD)
                                          2 segment     (topic boundaries)
                                          3 contextualise (cheap model writes a one-line context per chunk)
                                          4 embed + index (dense + sparse)
                                          5 slides      (keyframes -> OCR / vision caption -> chunks)
Object storage (R2) <--- presigned upload/playback        OpenTelemetry -> Grafana / PostHog LLM analytics
```

### 3.1 Ingestion: queue-driven, idempotent, resumable

Each stage is a job whose state lives in Postgres, so a crash resumes at the failed stage instead of stranding the lecture. Start with a Postgres queue (`SELECT ... FOR UPDATE SKIP LOCKED`, or a library such as pgmq or Procrastinate): zero new infrastructure and transactional with the state rows. Move to Redis or SQS only when you can name the limit you hit.

- **Transcription:** faster-whisper (CTranslate2) with voice-activity detection, which cuts the silence hallucinations Whisper is known for, and word-level timestamps, so a citation lands on the right second. Run on a Modal GPU: about $0.59 an hour on a T4, billed per second, with $30 a month free. A lecture hour should take a few GPU-minutes, so roughly $0.03 **(estimate; measure)**.
- **Slides:** lectures often live on the slide, not in the speech. Extract keyframes on scene change, run OCR or a vision model, and index the result as timestamped chunks. "What was on the board at 34:12" is a real differentiator and nothing in the current design reaches it.

### 3.2 Chunking and contextualisation

Replace fixed 75-second windows with boundaries where the topic changes (embedding-similarity valleys, TextTiling style), keeping a small overlap. Then give every chunk a one-sentence context written by a cheap model ("From Week 4, on why gradient descent stalls at saddle points"), embedded and keyword-indexed with the chunk.

Anthropic reports that contextual embeddings cut top-20 retrieval failures by 35% (5.7% to 3.7%), adding contextual keyword search by 49% (to 2.9%), and adding a reranker by 67% (to 1.9%), at about $1.02 per million document tokens with caching. That is about $0.012 per lecture hour **(estimate)**. Those are their datasets, not yours: treat them as a hypothesis the eval set must confirm.

### 3.3 Embeddings: choose by your data, not a leaderboard

Candidates: BGE-M3 (dense, sparse and multi-vector in one model, 8k tokens), Qwen3-Embedding (self-hosted, top of MTEB in the sources below), Nomic Embed v2, or a hosted API such as Voyage or Gemini Embedding. The leaderboard sources are vendor blogs, and MTEB is not your lectures. The procedure that survives scrutiny:

1. Generate 200 to 300 (question, lecture, timestamp) triples with Claude, and hand-verify at least 50.
2. Score every candidate, including the current MiniLM, on recall@5, recall@20 and MRR.
3. Pick the cheapest one that clears your bar. Store as `halfvec` and truncate with Matryoshka dimensions where the model supports it.

This is also where deep learning genuinely pays: embeddings and rerankers *are* the neural part. **Fine-tuning is a later step**, justified only if the eval shows retrieval is the bottleneck. The method then is contrastive training (multiple-negatives ranking loss) on synthetic question-passage pairs from your own corpus with hard negatives, and later a reranker trained on thumbs-up and citation-click data. Training a model before measuring one is the classic way to spend a month and learn nothing.

### 3.4 Vector store: stay on pgvector

One database, tenant filter and vector search in a single transaction, and it is already running. Leave it when you pass roughly 10 to 50 million vectors or need heavy filtered ANN (then Qdrant). Three specifics:

- **Filtered HNSW can return too few rows.** The index returns its nearest candidates first and the `user_id` filter is applied afterwards, so a busy multi-tenant table can lose results. pgvector 0.8 added iterative index scans (`hnsw.iterative_scan`); turn it on and test it with many tenants. **(Verify against the pgvector README.)**
- **Add hybrid search.** Postgres full-text search (`tsvector`) or BM25 via an extension, fused with the dense results by reciprocal rank fusion. Terms, names and formulas are exactly where dense-only retrieval is weakest.
- **Add a reranker** (a cross-encoder such as bge-reranker, or a hosted rerank API) over the top 50, passing the best 20 to the model.

### 3.5 The agent: a bounded loop, not a framework

"Agentic AI" here should mean a tool-using loop with hard limits, about 100 lines on the Anthropic tool-use API. A framework (LangGraph, CrewAI) adds abstraction churn and hides the parts you most need to see. Reconsider if you grow multi-agent workflows with durable state.

- **Tools (read-only):** `search_transcript(query, video_ids)`, `read_window(video_id, start, end)`, `get_slide_text(video_id, t)`, `list_lectures()`.
- **User-triggered writes only:** `make_study_guide`, `make_quiz`, `make_flashcards` (schedule reviews with FSRS), `compare_lectures`.
- **Limits:** at most 6 steps, a per-request cost ceiling tied to the existing quota, per-tool timeouts.
- **Citation verifier:** every `[mm:ss]` in an answer must fall inside a window the agent actually read. Anything else is stripped or regenerated. This is the single check that protects the product's promise.
- **Prompt injection:** transcripts and slides are untrusted text (a lecturer, or an uploaded file, can say "ignore your instructions"). Tool output goes in delimited blocks, and no retrieved content can trigger a write.
- **Model tiers:** a small model for routing, query rewriting and contextualisation; a mid-tier model for answers; the top tier only on explicit request. Keep the model id in config, as `claude_client.py` already does.

### 3.6 Evaluation and observability

- **Offline, in CI:** recall@k, MRR, citation validity (automatic), answer correctness by an LLM judge calibrated against your hand labels (a judge you have not calibrated is a random number generator with confidence).
- **Online:** PostHog events (already wired) plus LLM analytics, OpenTelemetry traces per request, and a thumbs control on every answer, which is also the future training signal.
- Log token counts and cost per message (already stored). Never log transcript or question text.

### 3.7 SaaS hardening

- **Postgres row-level security** keyed on a per-request setting, as a backstop to the manual `user_id` filters.
- **Deletion as a job:** rows, vectors, objects and the PostHog person, with a record that it ran. The privacy page already promises this.
- **Stripe usage billing:** cost per message is already metered, so credits are a small step. LLM spend is your dominant cost of goods, so meter it from day one.
- **Rate limits to Redis** once there is more than one API replica. Sentry for errors. Secrets from a secret manager, not files.

### 3.8 Frontend: libraries I would add, and when

Not added in this session, deliberately.

| Library | Replaces / adds | When |
|---|---|---|
| TanStack Query | The hand-written polling and refetch hooks (`useVideoLibrary`, `useConversations`, `useUsage`) | Next. Largest simplification. |
| openapi-typescript + openapi-fetch | The hand-copied `types/api.ts`, which can silently drift from FastAPI | Next |
| Radix primitives (shadcn style) | `window.confirm` for deletes, with a real accessible dialog | With the next destructive action |
| React Hook Form + Zod | Form state and validation | When forms outgrow three fields |
| Vidstack or media-chrome | The custom player, adding HLS, captions and keyboard behaviour | When you generate WebVTT captions from transcripts |
| TanStack Virtual | Long lecture lists | After about 100 items |
| Playwright + Vitest + MSW | Tests (there are none) | Before the first paying user |
| Vercel AI SDK | The 80-line SSE reader | Only if tool-call streaming UI grows. Today it is more dependency than gain. |

## 4. What each piece costs

LLM answers and video storage dominate. Servers barely register at small scale.

| Item | Cost | Source / note |
|---|---|---|
| Claude, per question | about $0.01 (cached whole lecture) to $0.02 (retrieval) | section 2 (estimate) |
| The $1 free plan in `config.py` | about 45 retrieval questions, or about 100 cached | section 2 (estimate) |
| Transcription | about $0.03 per lecture hour | Modal T4 (estimate) |
| Contextualisation | about $0.012 per lecture hour | Anthropic's figure (estimate) |
| Storage | 10 GB free, then $0.015 per GB-month, no egress fee | Cloudflare R2. A lecture hour is perhaps 0.5 to 1 GB (estimate), so about 10 to 20 hours free |
| Analytics | free: 1M events, 100k LLM events a month | PostHog |
| Auth | free Pro plan while you are a student | GitHub Student Pack (Clerk) |

## 5. Kubernetes, and where the credits actually go

**The case against.** Kubernetes solves coordination problems (many services, many teams, bursty fleets) that you do not have. It adds a control plane to pay for, upgrades to run, networking to debug, and an on-call rota of one. Concretely, the standard ingress controller (ingress-nginx) was retired by the Kubernetes project in March 2026 with no further security patches; the replacement is the Gateway API. A recommendation from two years ago is already obsolete. The most expensive resource in this project is your hours.

**Where it would pay.** The only parts shaped like Kubernetes workloads are the ingestion and GPU workers: queue-driven, bursty, scale-to-zero. That is the case for KEDA scaling on queue depth. The API and web do not need it.

**Control-plane fees, which start the moment the cluster exists:**

| Provider | Control plane | What your credits do to it |
|---|---|---|
| Azure AKS | **Free tier: $0** (no uptime SLA, intended for fewer than 10 nodes) | Only nodes cost. Best fit. |
| Google GKE | $0.10/hour, but a $74.40/month free-tier credit covers one zonal or Autopilot cluster | Fee is covered; node and pod compute are not. |
| Amazon EKS | $0.10/hour, about $73/month | A $100-200 credit lasts only about 1.5 to 3 months on the fee alone, before any node. Worst for a student. |

**Free credits for a student (checked 6 October 2026):**

| Offer | Amount | Catch |
|---|---|---|
| Azure for Students | $100 for 12 months, no credit card, renewable yearly while you are a student | Full-time university students |
| GitHub Student Developer Pack | Azure $100 (18+), Clerk Pro free, MongoDB Atlas $50, Datadog Pro 2 years, New Relic free, Namecheap `.me` domain and SSL for a year, Heroku $13/month for 24 months | Verification needed |
| Google Cloud | $300 for 90 days, plus an always-free tier | Trial expires; card required |
| AWS | $100 on sign-up plus up to $100 more for using services; the free plan ends at 6 months or when the credit is gone | Short. No student-specific credit that I could verify. |
| DigitalOcean | A $200 student credit existed earlier in 2026 | **Not on the pack page I fetched.** Secondary sources say it is gone. Do not plan on it. |
| Modal | $30 a month compute, free | |
| PostHog | Startup program up to $50k for companies under 2 years old and under $5M raised | Check whether a student company qualifies |

None of these carries a Kubernetes cluster for a year. $100 on two small AKS nodes plus a load balancer is roughly five to six weeks **(estimate: about $30 a month per 2 vCPU node, which I have not re-checked; use the Azure pricing calculator)**.

**What I recommend:**

- **Now ($0 to about $25 a month plus LLM use):** frontend on a static or edge host, API on Google Cloud Run (free tier covers 2M requests and 180,000 vCPU-seconds a month, and it scales to zero), Postgres on Neon (pgvector built in), storage on R2, ASR on Modal, Clerk and PostHog on free tiers. Check the host's terms: several "hobby" plans forbid commercial use.
- **Learn Kubernetes without paying for it:** write the manifests (Helm or Kustomize) and run them on `kind` or `k3d` locally. Add a Gateway API route, not ingress-nginx. When you have real users, do a one-month pilot on AKS Free or GKE using credits, then decide with measured numbers.
- **Real production on Kubernetes** (3 nodes, HA database, GPU burst) is realistically $300 to $600 a month before LLM spend **(estimate)**. Do not carry that until revenue does.

## 6. Roadmap, each phase with a way to fail

| Phase | Work | Exit criterion (falsifiable) |
|---|---|---|
| 0, done | Launch checklist, backend fixes | `lint`, `build`, axe and link checks pass |
| 1 | **Eval harness.** 200+ question set from your lectures, baseline recall@5/20, MRR, citation validity | You have a number for today's pipeline |
| 2 | Hybrid search, reranker, top 20, contextual chunks, long-context router | Beats the baseline on the eval set within a cost-per-question budget. If not, revert. |
| 3 | Queue-driven ingestion, GPU ASR with VAD and word timestamps, slide OCR | No lecture stuck in a processing state after a deploy |
| 4 | Agent loop with citation verifier, study guide and quiz | Task success and cost per task measured on a task set |
| 5 | RLS, deletion job, Stripe, Sentry, OTel, Redis limits, CI, containers, K8s pilot | A tenant-isolation test that tries to read another tenant's data and fails |

**Test demand before phase 4:** put the current product in front of 10 students who are not your friends. If they do not come back a second week, agents will not fix it.

## 7. Risks and hidden assumptions

1. **Copyright and privacy of the recordings.** Class recordings are typically the instructor's or school's property, may be restricted by institutional policy, and capture other people's voices. A product that stores and transcribes them carries real exposure, in the US (copyright, FERPA contexts) and elsewhere (GDPR consent). The terms put responsibility for the right to upload on the user and give a takedown route, but that does not remove your risk. Get a short legal review before charging anyone.
2. **Wrong timestamps destroy the product.** Whisper can hallucinate on silence and drift on timing. The citation verifier and word-level timestamps are not polish, they are the value proposition.
3. **Competition inside the platform.** Lecture-capture vendors and learning-management systems can ship transcript search and AI summaries, and a general chatbot with an uploaded transcript is free. Your defensible parts are timestamp-grounded citations, search across a whole semester, slides, and study workflows.
4. **Academic-integrity optics.** Schools may object. Position it as a study tool for your own recordings.
5. **Vendor concentration** in Anthropic, Clerk and Modal. The single-file Claude client is the right pattern; keep it for the others.
6. **Runaway cost** from unbounded agent loops and very long videos. Hard caps at every layer.
7. **Resume-driven machine learning.** Fine-tuning before measuring, or a custom model where an API call works.
8. **You are the bottleneck.** Every service you add multiplies your on-call load. Add a service only when you can name the limit you hit.

## 8. What changed in this session

The 20-point launch checklist is done in `client/` (legal pages, cookie consent gating PostHog, metadata and social image, sitemap and robots, custom 404, HSTS, form limits, axe and Lighthouse checks). On the server: database outages now return a readable 503, the Anthropic key from `.env` now reaches the SDK, failed jobs record their failure, the schema package is no longer gitignored, and per-user rate limits, input length limits and a default-secret startup guard were added. See the commit diff for the file list.

## 9. Sources

Checked 6 October 2026. Secondary sources (blogs and aggregators) are marked and should be confirmed on the vendor's own pricing page before you spend money.

- Azure for Students: https://azure.microsoft.com/en-us/free/students
- GitHub Student Developer Pack: https://education.github.com/pack
- AWS Free Tier credits: https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/
- Google Cloud free trial and free tier: https://docs.cloud.google.com/free
- GKE free-tier credit and fee (secondary): https://cast.ai/blog/gke-pricing-explained-how-to-choose-the-right-plan-for-you/
- AKS Free and Standard tiers: https://learn.microsoft.com/azure/aks/free-standard-pricing-tiers
- EKS control-plane price (secondary): https://cloudburn.io/blog/amazon-eks-pricing
- ingress-nginx retirement: https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/
- Anthropic, Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Embedding model comparison (secondary, vendor blog): https://blog.premai.io/best-embedding-models-for-rag-2026-ranked-by-mteb-score-cost-and-self-hosting
- Modal pricing (figures via aggregator): https://modal.com/pricing
- PostHog pricing: https://posthog.com/pricing
- PostHog Next.js proxy: https://posthog.com/docs/advanced/proxy/nextjs
- Cloudflare R2 pricing (secondary): https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/
- Cloud Run free tier (secondary): https://cloudchipr.com/blog/cloud-run-pricing
- pgvector iterative index scans: https://github.com/pgvector/pgvector (verify the 0.8 release notes)
