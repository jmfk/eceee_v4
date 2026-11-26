---
id: ADR-0082
title: Private Slack error notifications
status: accepted
date: 2026-11-25
related_prds:
  - PRD-0066
supersedes: []
superseded_by: []
---

# Private Slack error notifications

## Decision

Keep the CMS Inbox as the source of truth for support reports. Slack receives only a generic notice and a tenant-specific authenticated link for a new support-targeted bug. Private direct messages and ordinary questions are excluded.

Use an additive Django support outbox for report notifications and grouped server events. Existing support transactions and Python logging require small Python adapters; moving these flows into a new TypeScript service would duplicate ownership and add infrastructure. Publisher error capture remains in the existing TypeScript server. No browser receives a Slack credential.

Keep delivery disabled until its dedicated credentials and destination are configured. Reports use `#eceee-fel`; server errors use the separately confirmed `#eceee-serverfel`. Independent channel-specific incoming webhooks require no channel/list read access or Lists API scopes. Never infer production deployment permission from Slack setup. Treat provider timeouts/interrupted sends as uncertain; retry only explicit rate-limit rejections automatically. Retain bounded error codes instead of raw provider responses.

## Consequences

Support delivery survives worker restarts. The new table is additive and does not rewrite existing reports. Reports retain their existing tenant/participant authorization when a Slack link is opened. Slack channel membership grants no CMS access.

Server log capture is best effort before reaching the broker; an unavailable broker cannot be reported through that same broker. This is application error notification, not an independent host-availability monitor. Historical reports are not automatically sent.

The handler suppresses repeated sanitized groups before broker IO using a bounded
per-process ten-minute cache, with a shorter cooldown after enqueue failure. The
outbox uniqueness guard also suppresses duplicates across processes. The
long-lived Node publisher starts unhandled-error delivery in the background;
handled route failures use the response lifecycle. Neither path waits for Slack
before returning an application error response.

On 2026-11-26 the owner confirmed enabling both v4 streams in one PR. The reviewed
`make prod-configure-slack APPLY=yes` command stages the verified credentials and
both opt-in flags in the local protected deployment environment, preserving
unrelated settings. It performs no production operation; the ordinary separately
authorized tagged deploy ships that environment and applies the additive schema.

## Alternatives

- A new bot service with broad database access duplicates support ownership and adds an operational dependency.
- Forwarding raw logs or private reports discloses unnecessary content and is rejected.

## Links

- [PRD-0066](../../prds/0066-slack-error-reports.md)
- [Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/)
