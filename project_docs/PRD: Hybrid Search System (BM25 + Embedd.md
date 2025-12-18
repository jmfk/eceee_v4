# PRD: Hybrid Search System (BM25 + Embeddings + Reranking)

## 1. Overview

This document specifies a hybrid website search system combining:
- **Lexical search (PostgreSQL Full-Text Search ranking)** (`tsvector` + `ts_rank`/`ts_rank_cd`) (BM25-like, not exact BM25)
- **Semantic search (embeddings)** using `voyage-context-3`, 256 dimensions, quantized int8 (canonical storage)
- **Reranking** (cross-encoder or LLM-based)

The system is optimized for high relevance, low storage and compute cost, and scalable multi-tenant usage. The key design decision is using 256-dimension quantized embeddings, made viable through hybrid retrieval and reranking.

## 2. Goals

### Primary goals
- Deliver high-quality search results for natural-language queries.
- Minimize vector storage and memory usage.
- Maintain low query latency at scale.
- Support future improvements (rerankers, personalization, analytics).

### Non-goals
- Pure vector-only search.
- Fully generative search answers (this is retrieval, not QA).
- Research-grade semantic benchmarking.

## 3. Target Use Cases

- Website search (marketing pages, docs, FAQs)
- CMS content search
- Knowledge bases
- Help centers and support portals

### Content characteristics
- Short to medium documents.
- Clear headings and keywords.
- Mixed exact-term and semantic queries.

## 4. System Architecture (High Level)

1. **User Query**
2. **Query Normalization**
3. **Parallel Retrieval**
   - Postgres FTS Search (lexical)
   - Vector Recall (256-dim quantized embeddings; ANN via derived float vector where needed)
4. **Candidate Merge & Deduplication**
5. **Reranking** (cross-encoder or LLM)
6. **Final Ranked Results**

## 5. Retrieval Strategy

### 5.1 Lexical Retrieval (PostgreSQL Full-Text Search Ranking)
- **Purpose**: Capture exact terms, names, IDs, jargon; anchor results to user language.
- **Implementation**: PostgreSQL full-text search, OpenSearch, or Elasticsearch.
- **Output**: Top N₁ documents (default: 100), including FTS rank score (`ts_rank` / `ts_rank_cd`).

**Note**: PostgreSQL FTS ranking is BM25-like, but not identical to true BM25 unless a dedicated extension is introduced.

### 5.2 Semantic Retrieval (Embeddings)
- **Model**: `voyage-context-3` (256 dimensions, quantized int8).
- **Purpose**: Capture paraphrases and intent; recover recall missed by lexical search.
- **Output**: Top N₂ documents (default: 100), including similarity score.

**Storage and scoring note**:
- Canonical embeddings are stored as **int8** (256 bytes) plus small per-vector quantization metadata (e.g., `scale`, optional `zero_point`).
- For fast ANN (e.g., ivfflat), maintain a **derived float vector representation** for pgvector distance operators and indexing.

**Rationale for 256 dimensions**:
- Used only for recall, not final ranking.
- Hybrid retrieval compensates for reduced semantic resolution.
- Quantization reduces storage and memory bandwidth by ~8× vs float32.

## 6. Candidate Merging

- **Process**: Union lexical (FTS) and vector result sets, deduplicate by document ID, and preserve source scores.
- **Result**: Combined candidate set (~150 documents typical).
- **Design Principle**: Precision is not critical at this stage; recall is.

## 7. Reranking

- **Purpose**: Evaluates "How well does this document answer this exact query?".
- **Options**:
  - **Option A (Cross-encoder)**: Fast, deterministic, cost-controlled. Best for high QPS.
  - **Option B (LLM-based)**: Higher quality for nuanced queries, but higher latency/cost.
- **Default Configuration**: Rerank top ~100–150 candidates; return top 10–20 results.

## 8. Ranking Logic

Final ranking is based on:
1. Reranker score (primary).
2. Secondary signals (optional): Freshness, CTR, editorial boosts.

## 9. Storage & Cost Considerations

**Embedding Storage (Vectors Only)**:
Assuming 256 dimensions, int8 quantization, and one embedding per document:

| Documents | Storage |
| :--- | :--- |
| 1,000 | ~256 KB |
| 100,000 | ~25 MB |
| 1,000,000 | ~250 MB |

## 10. Performance Targets

| Metric | Target |
| :--- | :--- |
| P95 query latency | < 300 ms |
| Vector search latency | < 30 ms |
| Reranking latency | < 150 ms |
| Recall@100 | High (qualitative acceptance) |

## 11. Failure Modes & Mitigations

- **Risk: Semantic collisions at 256 dims**: Hybrid retrieval ensures lexical anchors; reranker corrects errors.
- **Risk: Missing documents**: Increase N₁ / N₂ depth; monitor zero-result queries; fallback to lexical FTS.

## 12. Rollout Plan

1. Implement FTS-only baseline.
2. Add vector search with 256-dim embeddings.
3. Enable hybrid merging.
4. Introduce reranker.
5. A/B test (FTS vs Hybrid, Hybrid vs Hybrid + Rerank).

## 13. Success Metrics

- Query success rate.
- Click-through on top 3 results.
- Reduction in “no result” queries.
- User dwell time on result pages.
- Cost per 1,000 searches.

## 14. Key Insight (Design Rationale)

This system avoids asking embeddings to do fine-grained judgment. Embeddings retrieve, lexical search anchors language, and rerankers decide relevance. This separation makes 256-dimension embeddings optimal for cost-efficient, high-quality website search.

---

# PRD Addendum: Internal URL Linking & Resolution

## 1. Requirement Summary
The search system must return results that link to internal URLs. Each result must be directly navigable without post-processing on the client.

## 2. Functional Requirements
- **URL Association**: Each document must have one canonical internal URL (e.g., `/docs/getting-started`).
- **URL Stability**: Support stable URLs and metadata-only updates without full reindexing.

## 3. Data Model (Required Fields)
- `document_id` (UUID)
- `title` (text)
- `body` (text)
- `internal_url` (text)
- `language` (optional)
- `tenant_id` (UUID)

---

# PRD Addendum: Version-Aware Search & Public Visibility Filtering

## 1. Requirement Summary
The system must index content stored under version control while ensuring only published versions are visible to public queries.

## 2. Content Versioning Model
- **Logical Document**: Stable identity (e.g., “About page”).
- **Version**: Immutable snapshot of content.

## 3. Required Version Metadata
- `document_id` (UUID)
- `version_id` (UUID)
- `status` (draft, published, archived, deleted)
- `is_current` (boolean)
- `publish_from`, `publish_until` (timestamps)
- `internal_url` (text)

## 4. Indexing Strategy
- **All versions are indexed** in FTS and vector recall structures to allow instant rollback and preview search.
- **Embeddings** are generated per version from `title + body`.

## 5. Public Search Visibility Rules
A document version is publicly visible if:
```
status = 'published'
AND is_current = true
AND publish_from IS NOT NULL
AND publish_from <= now()
AND (publish_until IS NULL OR publish_until > now())
```

## 6. Internal URLs Across Versions
All versions of a logical document share the same `internal_url`. The URL always resolves to the current published version.
