---
id: ADR-0067
title: Include legacy publications and report pages in the local import trial
status: accepted
date: 2026-11-07
related_prds:
  - PRD-0034
supersedes:
  - ADR-0056
superseded_by: []
---

# ADR-0067: Include legacy publications and report pages in the local import trial

## Context

ADR-0056 excluded `EceeeLibraryItem` and `ReportPage` after the former had zero published site-2 records in an earlier inventory. The owner now explicitly wants both included when preparing a complete local legacy import trial.

## Decision

- Include `publications` and `reports` alongside the five existing editorial resources in source inventory, frozen manifests, draft import, resume, and outcome reports.
- Export `ReportPage` through a new allowlisted, read-only legacy API resource scoped to the configured site and published records. Preserve its source URL, public content, report URL, categories, and attachment provenance without exporting private page or account fields.
- Map both resources to the existing `library_item` object type. Keep resource and source ID distinct in import bindings. Do not publish imported drafts automatically.
- Keep the reviewed taxonomy gate. Newly discovered report or publication terms require an explicit map update before those items can be imported; do not infer or create terms during import.
- Inventory both resource counts before the full trial. Review any potential duplicate represented in both resources before publication. The local trial does not authorize legacy or v4 production deployment.

## Consequences

The legacy API and v4 importer need coordinated changes. The earlier zero publication count must be checked again. ReportPage counts and terms are not yet known; the full seven-resource trial remains gated until the source API is available and its term mapping has been reviewed.

## Links

- [PRD-0034](../../prds/0034-simplified-legacy-content-import.md)
- [ADR-0056](../archive/0056-exclude-legacy-publications-from-editorial-import.md)
