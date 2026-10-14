---
id: ADR-0027
title: Durable PostgreSQL runs with cooperative steering
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0021
  - PRD-0022
  - PRD-0023
supersedes: []
superseded_by: []
---

# ADR-0027: Durable PostgreSQL Runs with Cooperative Steering

## Context

The existing generic AI task prototype stores coarse task state in PostgreSQL but treats Celery task identity and hard revocation as execution control. A CMS agent needs editable queues, safe retries, tool-level idempotency, browser-independent progress, cooperative stop, steering, and checkpoint recovery. Redis/Celery delivery alone cannot be the durable workflow record.

## Decision

Store sessions, queue items, run attempts, public events, tool calls, steer instructions, cancellation requests, and checkpoints in PostgreSQL. Celery with the existing shared Redis service wakes and hosts workers; Django Channels streams committed events to clients. Neither Redis nor an in-memory provider session is authoritative.

A worker transactionally claims one eligible queue item using row locking. One mutating run may own a target aggregate at a time. Tool mutations are committed through their domain service with an idempotency key, and the tool-call record stores reviewed and resulting revisions.

Steer is an append-only instruction applied at a safe boundary after the current model step or tool call and before the next mutation. Stop sets `cancel_requested`; workers stop cooperatively at the next boundary. When provider cancellation is unavailable, the eventual model result is discarded and no subsequent tool is executed. Hard process termination is an operator recovery action, not ordinary product behavior.

Checkpoints are written after accepted plans, completed mutating tools, compaction, waits for user input, and terminal transitions. A lease and heartbeat allow another worker to recover abandoned runs. Recovery re-reads authoritative domain state and never assumes an unconfirmed provider response was applied.

## Rationale

PostgreSQL already owns product records and gives the queue a recoverable, queryable, transactional state machine. Existing Celery and Channels infrastructure can be reused without allowing transient transport state to decide whether work was completed.

## Consequences

- New agent tables and migrations are required.
- Workers need explicit leases, heartbeats, idempotency, and recovery tests.
- Steering latency is bounded by the current provider/tool step rather than guaranteed to be instantaneous.
- Queue edits are simple and safe before claim; running work is controlled through steer/stop rather than mutation of the original prompt.
- The old generic AI task surface may coexist but must not share ambiguous ownership of a run.

## Alternatives Considered

- Use Celery task state as the workflow: rejected because queue edits, durable steering, and exactly-once domain effects are not represented.
- Hard-revoke the active Celery process: rejected because termination can interrupt a database or external operation at an unknown point.
- Add Kafka, Temporal, or another workflow service immediately: rejected because the current volume does not justify another control plane.
- Execute the agent in the web request: rejected because long runs, reconnects, and provider latency exceed request lifetimes.

## Links

- Related PRDs: [PRD-0021](../../prds/0021-embedded-cms-agent-platform.md), [PRD-0022](../../prds/0022-design-agent.md), [PRD-0023](../../prds/0023-cms-content-agent.md)
