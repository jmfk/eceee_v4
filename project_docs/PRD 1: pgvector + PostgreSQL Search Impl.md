# PRD 1: pgvector + PostgreSQL Search Implementation

## 1. Purpose

Define a PostgreSQL-based search backend using `pgvector` to support:
- Hybrid search (Postgres FTS + vector recall + reranking)
- 256-dimension quantized embeddings (`voyage-context-3`) stored as int8
- Versioned content
- High tenant density
- Predictable cost and performance

PostgreSQL is the source of truth for both content metadata and search indexes.

## 2. Technology Stack

- **PostgreSQL**: ≥ 15
- **pgvector**: ≥ 0.6
- **Text Search**: PostgreSQL Full-Text Search (`tsvector` + `ts_rank`/`ts_rank_cd`) (BM25-like, not exact BM25)
- **RabbitMQ**: (Future, not required for core search)
- **Optional**: `pg_trgm` for fallback similarity

## 3. Core Tables

### 3.1 documents
Represents the logical document identity.

```sql
CREATE TABLE documents (
  document_id     UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  internal_url    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, internal_url)
);
```

### 3.2 document_versions
Immutable content snapshots.

```sql
CREATE TABLE document_versions (
  version_id       UUID PRIMARY KEY,
  document_id      UUID NOT NULL REFERENCES documents(document_id),
  tenant_id        UUID NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  status           TEXT CHECK (status IN ('draft', 'published', 'archived', 'deleted')),
  is_current       BOOLEAN NOT NULL,
  publish_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
  publish_until    TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL
);
```

**Note**: enforcing “only one current version per document” is done via a partial unique index:

```sql
CREATE UNIQUE INDEX uniq_document_current_version
ON document_versions (document_id)
WHERE is_current = true;
```

### 3.3 document_search_index
Search-optimized table.

```sql
CREATE TABLE document_search_index (
  version_id      UUID PRIMARY KEY REFERENCES document_versions(version_id),
  tenant_id       UUID NOT NULL,
  tsv             TSVECTOR NOT NULL,
  -- Canonical embedding storage: int8 quantized vector (256 bytes).
  embedding_int8  BYTEA NOT NULL,
  -- Quantization metadata (per-vector). Defaults depend on quantizer.
  embedding_scale REAL NOT NULL,
  embedding_zp    SMALLINT NOT NULL DEFAULT 0,
  -- Optional: derived float vector for pgvector ANN (storage can be dropped if unacceptable).
  embedding_vec   VECTOR(256)
);
```

### 3.4 Integrity & consistency notes (recommended)

`tenant_id` is duplicated to allow tenant-local indexing and RLS. It must be consistent across tables:
- `document_versions.tenant_id` must equal `documents.tenant_id` for the referenced `document_id`.
- `document_search_index.tenant_id` must equal `document_versions.tenant_id` for the referenced `version_id`.

One way to enforce this in SQL is to use composite foreign keys:

```sql
ALTER TABLE documents
  ADD CONSTRAINT uniq_documents_document_id_tenant_id UNIQUE (document_id, tenant_id);

ALTER TABLE document_versions
  ADD CONSTRAINT fk_versions_document_tenant
  FOREIGN KEY (document_id, tenant_id)
  REFERENCES documents (document_id, tenant_id);

ALTER TABLE document_versions
  ADD CONSTRAINT uniq_versions_version_id_tenant_id UNIQUE (version_id, tenant_id);

ALTER TABLE document_search_index
  ADD CONSTRAINT fk_search_index_version_tenant
  FOREIGN KEY (version_id, tenant_id)
  REFERENCES document_versions (version_id, tenant_id);
```

## 4. Indexing Strategy

### Lexical (PostgreSQL Full-Text Search)
```sql
CREATE INDEX idx_search_tsv ON document_search_index USING GIN (tsv);
```

### Vector Search (ANN over derived float vector)
```sql
CREATE INDEX idx_search_embedding_vec ON document_search_index
USING ivfflat (embedding_vec vector_cosine_ops)
WITH (lists = 100);
```

### Index maintenance (when to write `document_search_index`)
- `document_search_index` rows are written/updated **per version** (not per document).
- `tsv` is computed from version content (e.g., `title || ' ' || body`) and updated when a version is created/updated.
- `embedding_int8` is generated from version content (same input as `tsv`) and stored alongside quantization metadata.
- `embedding_vec` is derived from `embedding_int8` (dequantized to float) for pgvector operators/indexing.

**Indexing policy**: all versions may be indexed to support preview/rollback; public search visibility remains a query-time filter.

## 5. Query Pattern (Public Search)

Public search is a two-stage retrieval process:

1) retrieve candidates via lexical and vector recall
2) rerank candidates (recommended) and apply final ordering

```sql
WITH visible_versions AS (
  SELECT v.version_id
  FROM document_versions v
  WHERE
    v.tenant_id = :tenant_id
    AND v.status = 'published'
    AND v.is_current = true
    AND v.publish_from <= now()
    AND (v.publish_until IS NULL OR v.publish_until > now())
)
SELECT
  v.document_id,
  d.internal_url,
  v.title
FROM visible_versions vv
JOIN document_search_index s ON s.version_id = vv.version_id
JOIN document_versions v ON v.version_id = vv.version_id
JOIN documents d ON d.document_id = v.document_id
ORDER BY ts_rank_cd(s.tsv, plainto_tsquery(:query)) DESC
LIMIT 20;
```

**Vector recall** is executed as a separate candidate query (example), then merged/deduped with lexical candidates before reranking:

```sql
WITH visible_versions AS (
  SELECT v.version_id
  FROM document_versions v
  WHERE
    v.tenant_id = :tenant_id
    AND v.status = 'published'
    AND v.is_current = true
    AND v.publish_from <= now()
    AND (v.publish_until IS NULL OR v.publish_until > now())
)
SELECT vv.version_id
FROM visible_versions vv
JOIN document_search_index s ON s.version_id = vv.version_id
ORDER BY s.embedding_vec <=> :query_embedding_vec
LIMIT 100;
```

## 6. Design Guarantees

- Search is fully relational.
- Visibility filtering is enforced at query time.
- No vector DB lock-in.
- Easy backups, replication, and auditing.

## 7. Non-goals

- Cross-tenant search.
- Real-time embedding updates.
- Vector-only ranking.
