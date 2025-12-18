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
   - Sets previous `is_current = false`.
   - Sets new version `is_current = true`.
   - Updates `status = 'published'`.
3. Commit transaction.
4. Emit `content.published` event.

**Note**: No re-embedding or reindexing is required.

## 5. Unpublish Flow

1. Editor unpublishes.
2. System:
   - Sets `status = 'archived'`.
   - Sets `is_current = false`.
3. Commit transaction.
4. Emit `content.unpublished` event.

**Clarification**: this PRD assumes unpublish leaves **no public version** for the document (canonical URL returns 404/not found for public users) until another version is published.
If rollback-to-previous-published is desired instead, update step (2) to set the previous published version to `is_current = true` and emit a `content.published` event for that version.

## 6. Event Payload (Example)

```json
{
  "event": "content.published",
  "tenant_id": "...",
  "document_id": "...",
  "version_id": "...",
  "internal_url": "/docs/intro",
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
**Idempotency**: consumers must treat `(event_type, tenant_id, version_id)` as idempotent keys; replays may occur.

## 10. Design Insight

This architecture cleanly separates:
- **Truth**: Postgres
- **Visibility**: Query filters
- **Reactivity**: Events

It scales without turning search into a distributed mess.
