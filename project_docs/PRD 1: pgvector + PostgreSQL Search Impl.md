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

### 3.1 webpages_webpage (WebPage)
Represents the logical page identity (Phase 1 indexing target).

```sql
-- Django model: webpages.models.WebPage
-- Canonical internal URL (path only): cached_path
-- Tenant: tenant_id
-- Soft delete: is_deleted
CREATE TABLE webpages_webpage (
  id                          BIGSERIAL PRIMARY KEY,
  tenant_id                   UUID NOT NULL,
  cached_path                 TEXT NOT NULL,
  is_deleted                  BOOLEAN NOT NULL DEFAULT false,
  current_published_version_id BIGINT NULL,
  latest_version_id           BIGINT NULL,
  created_at                  TIMESTAMPTZ NOT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL
  -- ... additional WebPage fields omitted ...
);
```

### 3.2 webpages_pageversion (PageVersion)
Immutable content snapshots for a page. Publication is **date-based**.

```sql
-- Django model: webpages.models.PageVersion
-- NOTE: this table does NOT carry tenant_id in the current schema.
CREATE TABLE webpages_pageversion (
  id             BIGSERIAL PRIMARY KEY,
  page_id        BIGINT NOT NULL REFERENCES webpages_webpage(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_title  TEXT NOT NULL DEFAULT '',
  page_data      JSONB NOT NULL,
  widgets        JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_date TIMESTAMPTZ NULL,
  expiry_date    TIMESTAMPTZ NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  UNIQUE (page_id, version_number)
  -- ... additional PageVersion fields omitted ...
);
```

**Note**: “current published version” is cached on `webpages_webpage.current_published_version_id`
and derived from date-based visibility (latest version with `effective_date <= now()` and not expired).

### 3.3 search_pageversion_index (new)
Search-optimized table keyed by `webpages_pageversion.id`. This is a **new table we will add** for
pgvector + FTS. We denormalize `tenant_id` and `cached_path` to make RLS and result linking fast.

```sql
CREATE TABLE search_pageversion_index (
  page_version_id  BIGINT PRIMARY KEY REFERENCES webpages_pageversion(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  page_id          BIGINT NOT NULL,
  cached_path      TEXT NOT NULL,
  tsv              TSVECTOR NOT NULL,
  -- Canonical embedding storage: int8 quantized vector (256 bytes).
  embedding_int8   BYTEA NOT NULL,
  -- Quantization metadata (per-vector). Defaults depend on quantizer.
  embedding_scale  REAL NOT NULL,
  embedding_zp     SMALLINT NOT NULL DEFAULT 0,
  -- Optional: derived float vector for pgvector ANN (storage can be dropped if unacceptable).
  embedding_vec    VECTOR(256)
);
```

### 3.4 Integrity & consistency notes (recommended)

For Phase 1 (pages), tenant ownership is on `webpages_webpage.tenant_id`. Since
`webpages_pageversion` does not carry `tenant_id`, enforce tenant-scoped access by joining via `page_id`.
The new `search_pageversion_index.tenant_id` is denormalized from `webpages_webpage.tenant_id`.

One way to enforce this in SQL is to use constraints at write time:

```sql
-- Ensure page_id + cached_path stay consistent (cached_path is authoritative on WebPage)
ALTER TABLE search_pageversion_index
  ADD CONSTRAINT fk_search_page
  FOREIGN KEY (page_id) REFERENCES webpages_webpage(id) ON DELETE CASCADE;
```

## 4. Indexing Strategy

### Lexical (PostgreSQL Full-Text Search)
```sql
CREATE INDEX idx_search_tsv ON search_pageversion_index USING GIN (tsv);
```

### Vector Search (ANN over derived float vector)
```sql
CREATE INDEX idx_search_embedding_vec ON search_pageversion_index
USING ivfflat (embedding_vec vector_cosine_ops)
WITH (lists = 100);
```

### Index maintenance (when to write `search_pageversion_index`)
- `search_pageversion_index` rows are written/updated **per page version**.
- `tsv` and embeddings are computed from version content (e.g. `page_data` + extracted widget text).
- `embedding_int8` is generated from the same input as `tsv` and stored alongside quantization metadata.
- `embedding_vec` is derived from `embedding_int8` (dequantized to float) for pgvector ops/indexing.

**Indexing policy**: all versions may be indexed to support preview/rollback; public search visibility remains a query-time filter.

## 5. Query Pattern (Public Search)

Public search is a two-stage retrieval process:

1) retrieve candidates via lexical and vector recall
2) rerank candidates (recommended) and apply final ordering

```sql
WITH visible_page_versions AS (
  SELECT pv.id AS page_version_id
  FROM webpages_pageversion pv
  JOIN webpages_webpage p ON p.id = pv.page_id
  WHERE
    p.tenant_id = :tenant_id
    AND p.is_deleted = false
    AND pv.effective_date IS NOT NULL
    AND pv.effective_date <= now()
    AND (pv.expiry_date IS NULL OR pv.expiry_date > now())
)
SELECT
  p.id AS page_id,
  p.cached_path
FROM visible_page_versions vv
JOIN search_pageversion_index s ON s.page_version_id = vv.page_version_id
JOIN webpages_pageversion pv ON pv.id = vv.page_version_id
JOIN webpages_webpage p ON p.id = pv.page_id
ORDER BY ts_rank_cd(s.tsv, plainto_tsquery(:query)) DESC
LIMIT 20;
```

**Vector recall** is executed as a separate candidate query (example), then merged/deduped with lexical candidates before reranking:

```sql
WITH visible_page_versions AS (
  SELECT pv.id AS page_version_id
  FROM webpages_pageversion pv
  JOIN webpages_webpage p ON p.id = pv.page_id
  WHERE
    p.tenant_id = :tenant_id
    AND p.is_deleted = false
    AND pv.effective_date IS NOT NULL
    AND pv.effective_date <= now()
    AND (pv.expiry_date IS NULL OR pv.expiry_date > now())
)
SELECT vv.page_version_id
FROM visible_page_versions vv
JOIN search_pageversion_index s ON s.page_version_id = vv.page_version_id
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

## 8. Phase 1 indexing target
- Index **pages only**:\n  - `webpages_webpage` + `webpages_pageversion`\n  - `search_pageversion_index` (new)\n+- Defer indexing `object_storage` (`ObjectInstance` / `ObjectVersion`) until we have a canonical internal URL strategy for objects.
