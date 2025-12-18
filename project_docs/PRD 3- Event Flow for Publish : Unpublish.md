# PRD 3: Event Flow for Publish / Unpublish (RabbitMQ-ready)

## 1. Purpose

Define a decoupled event-driven lifecycle for content publishing. Publishing must:
- Be fast
- Be reversible
- Not trigger reindexing storms
- Prepare for future async consumers (cache, CDN, analytics)

## 2. Event Philosophy

- Publishing is a metadata transition, not a content mutation.
- Embeddings are generated before publish.
- Publication state in eceee_v4 is **date-based** (`effective_date` / `expiry_date`) on `webpages_pageversion`.

## 3. Events (Logical)

| Event | Description |
| :--- | :--- |
| `content.created` | New version created |
| `content.published` | Version becomes public |
| `content.unpublished` | Version removed from public |
| `content.archived` | Historical version |
| `content.deleted` | Hard removal |

## 4. Publish Flow

### Step-by-step
1. Editor publishes a version.
2. System:
   - Sets `webpages_pageversion.effective_date = now()` (or schedules it in the future).
   - Optionally clears/sets `webpages_pageversion.expiry_date`.
   - Updates the cached pointer on `webpages_webpage.current_published_version_id` (denormalized, not authoritative).
3. Commit transaction.
4. Emit `content.published` event.

**Note**: No re-embedding or reindexing is required.

## 5. Unpublish Flow

1. Editor unpublishes.
2. System:
   - Removes public visibility via dates:\n     - Option A: set `expiry_date = now()` on the currently published version.\n     - Option B: clear `effective_date` on a version to make it a draft (not publicly visible).
3. Commit transaction.
4. Emit `content.unpublished` event.

**Clarification (eceee_v4 behavior)**: if an older published version exists (date-visible), public resolution may fall back to that older version after unpublishing a newer one. If no other published versions exist, the page becomes non-public.

## 6. Event Payload (Example)

```json
{
  "event": "content.published",
  "tenant_id": "...",
  "page_id": "...",
  "page_version_id": "...",
  "cached_path": "/docs/intro/",
  "timestamp": "..."
}
```

## 7. RabbitMQ Integration (Future)

- **Topic exchange**: `content.lifecycle`
- **Routing keys**:
  - `content.published`
  - `content.unpublished`
- **Consumers**:
  - Cache invalidation
  - Search warmup
  - CDN purge
  - Analytics

## 8. Guarantees

- Search visibility changes immediately (DB state).
- Events are side effects, not authorities.
- Search never depends on RabbitMQ availability.

## 9. Failure Modes

### RabbitMQ down
- Publish still succeeds.
- Event replay supported via outbox table.

### Outbox table (minimal)

```sql
CREATE TABLE content_event_outbox (
  event_id      UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ NULL,
  attempts      INT NOT NULL DEFAULT 0,
  last_error    TEXT NULL
);

CREATE INDEX idx_content_event_outbox_unprocessed
ON content_event_outbox (created_at)
WHERE processed_at IS NULL;
```

**Emission**: write outbox rows in the same transaction as the publish/unpublish change, and publish to RabbitMQ on `transaction.on_commit`.
**Idempotency**: consumers must treat `(event_type, tenant_id, page_version_id)` as idempotent keys; replays may occur.

## 10. Design Insight

This architecture cleanly separates:
- **Truth**: Postgres
- **Visibility**: Query filters
- **Reactivity**: Events

It scales without turning search into a distributed mess.
