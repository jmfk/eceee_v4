---
id: ADR-0023
title: Reconcile legacy News links and retain disabled link evidence
status: accepted
date: 2026-10-12
related_prds:
  - PRD-0012
supersedes: []
superseded_by: []
---

# ADR-0023: Reconcile Legacy News Links and Retain Disabled Link Evidence

## Context

Legacy News bodies contain links to other ECEEE pages and News articles as well as external sites. Copying those URLs unchanged leaves legacy routes in canonical content, while retaining links whose targets no longer exist produces broken navigation. Unresolved links must also remain identifiable so a later import can reconcile them when more destination content exists.

## Decision

During a write-mode import, resolve links in the sanitized article body as follows:

- Rewrite internal links to a relative v4 route only when the destination is a published page or an existing currently effective migrated News object.
- Replace an unresolved internal `<a>` with `<span class="legacy-link-unresolved">` and retain the sanitized original link attributes, including `href`. Record the reason in `data-legacy-link-status`.
- Keep `mailto:` and `tel:` links as links.
- Check each unique external HTTP(S) destination with a bounded, redirect-aware HEAD request. Retain the `<a>` only when the final response is exactly 200; otherwise use the same marked `<span>` representation.
- Resolve every outbound destination to public addresses and pin the connection to a validated address while retaining the original HTTP Host and TLS identity. Repeat that process for every redirect, cache checks within the import, and check independent destinations concurrently with a small fixed worker bound.
- Continue removing unsafe schemes, event handlers, inline styles, and other attributes outside the sanitizer allowlist. “Retain attributes” means all sanitizer-approved link attributes, never executable or unsafe markup.
- Include the rewritten body in the transformed content checksum so a later successful reconciliation creates a normal new object version without duplicate objects.

The structured `externalUrl` field is not body HTML and remains governed by its existing object contract; this decision applies to anchor elements embedded in imported body content.

## Rationale

The marked span prevents users from following a known-bad destination while retaining enough source evidence for deterministic later repair. Exact-200 HEAD behavior follows the migration policy without downloading external response bodies. A later idempotent rerun reconciles links after additional destination objects exist. DNS-pinned connections prevent imported content from turning the importer into an internal-network probe through DNS rebinding.

## Consequences

- Completed imports contain no known unresolved internal body anchors and no external body anchors whose HEAD result was non-200 or unreachable at import time.
- External availability is time-dependent; rerunning the idempotent import may legitimately enable or disable a link and create a new object version.
- Links to objects created later in the same batch remain marked spans until an idempotent rerun verifies and reconciles those now-existing targets.
- Servers that reject HEAD despite serving GET are treated as unavailable, as required by the exact-200 policy.
- Disabled links retain safe source attributes and a machine-readable reason through the ContentWidget cleaning pipeline.

## Alternatives Considered

- Keep every legacy link unchanged: rejected because it preserves known broken navigation and legacy routes.
- Delete unresolved links entirely: rejected because it loses reparsing evidence and link text semantics.
- Fall back from HEAD to GET: rejected because it would not implement the requested exact HEAD result and would download unnecessary response bodies.
- Preserve arbitrary original attributes: rejected because event handlers, unsafe URLs, and inline presentation would violate the import security boundary.

## Links

- Related PRDs: PRD-0012
