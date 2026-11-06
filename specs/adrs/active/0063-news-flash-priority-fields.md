---
id: ADR-0063
title: Published news priority with optional expiry
status: accepted
date: 2026-11-06
related_prds:
  - PRD-0044
supersedes: []
superseded_by: []
---

# ADR-0063: Published News Priority with Optional Expiry

## Owner Clarification

News Flash uses the three latest news stories, but editors can prioritize a news story until a newer prioritized story arrives or until a best-before date. The controls belong in the object-type definition, not a database model or object metadata flag.

## Decision

Add optional camelCase fields `newsPriority` (boolean, default false) and `newsPriorityUntil` (datetime) to the Article object-type definition. Existing records remain valid without either field. Update the initial-install profile and preserve all unrelated fields when updating the local live definition through the scoped API.

The published TypeScript reader makes two bounded, tenant- and classification-scoped queries in the same snapshot: latest three published objects, and latest published object whose live version has `newsPriority: true`. Newest means the existing live effective-publication order, with object ID as its stable tie-breaker. Draft/future/unpublished versions do not affect selection.

If that newest priority has no expiry, it leads until replaced. If it expires, use the latest three instead of reviving an older priority. Invalid expiry values fail closed. An expiry is exclusive: at the stored timestamp, priority ends. A currently published story may still appear among the ordinary latest three after its priority expires. Exclude duplicates when filling the two remaining positions.

Editor preview uses the same TypeScript selector through the existing public news-preview route. Public pages already resolve dynamically, so the next request reflects expiry without a cron job or data rewrite.

## Consequences

- No migration, scheduled job or new Python selection logic.
- Object editors use their existing schema-generated boolean and datetime controls; priority takes effect only when that object version is published.
- Reprioritizing an old story does not silently change its original publication ordering; publishing a newer version supplies the existing effective publication order.
- Only the local Article definition is updated during implementation. Production definition updates and deployment remain separate operations.

## Links

- [PRD-0044](../../prds/0044-news-flash-widget.md)
- [ADR-0062](0062-news-flash-typescript-rendering.md)
