---
id: ADR-0052
title: Explicit read-only system diagnostics
status: accepted
date: 2026-10-23
related_prds:
  - PRD-0037
supersedes: []
superseded_by: []
---

# Explicit read-only system diagnostics

Extend the supported machine API with a separate diagnostics boundary. This narrowly extends ADR-0016's application-data boundary with masked database inspection and exported diagnostic events; shell execution and database administration remain excluded. The existing full-access scope is not sufficient. Only explicitly scoped machine principals may enter this boundary; normal CMS role defaults do not acquire diagnostic permissions.

A dedicated PostgreSQL login receives SELECT only on security-barrier diagnostic views owned by a separate non-login role with reviewed column grants. Tenant conditions are enforced in views using transaction-local UUID selections; indirect ownership follows reviewed joins. Global views additionally require the explicit global capability. All current model fields are inventoried with unreviewed fields excluded. Masked text is constant rather than derived from raw data, preventing filter inference. No raw SQL is accepted.

A host timer exports sanitized diagnostics to a backend read-only mount. Signed structured application errors carry trustworthy tenant context; unsigned legacy records remain global and are reduced to recognized exception classes and stack metadata. Unknown raw text is discarded. Signing uses a separate protected key shared only by emitters and the host collector. This prevents client-controlled log lines from forging tenant attribution. There is no Docker socket or host-command endpoint in the web process.

Exports use immutable bounded segments with immutable generation manifests; pagination binds the query, key and allowed tenant selection to an opaque signed expiring cursor whose bounded continuation state uses the existing cache. Collection failure, skipped unknown records, retention and truncation are reported explicitly. The collector is not an archival replacement; historical rotated-away logs cannot be recovered.

Provisioning is explicit, additive and repeatable. Production installation and credential changes remain subject to separate owner gates. Disabling the feature and timer stops access without rewriting application records; diagnostic files can expire normally. No user-facing CMS UI is added.

## Recovery verification

Publication writes a local journal containing sanitized segment batches and the corresponding collector state before publishing either. A restart finishes that exact publication with the same segment names before ingesting new input. Atomic file replacements fsync their parent directory; retention uses immutable creation timestamps rather than rewrite times. Source metadata summarizes long gap histories to preserve the API response bound.
