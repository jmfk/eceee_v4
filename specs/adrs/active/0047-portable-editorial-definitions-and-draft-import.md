---
id: ADR-0047
title: Portable editorial definitions and checkpointed draft imports
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0034
  - PRD-0031
supersedes: []
superseded_by: []
---

# ADR-0047: Portable editorial definitions and checkpointed draft imports

## Context

The owner requests working dev definitions and a substantial legacy sample, with a path to later production synchronization and full import. Definitions are CMS data, not tenant-specific schema migrations. Legacy currently exposes only the original News endpoint.

## Decision

- Keep an initial editorial profile in code. After installation, export the live CMS definitions through tenant-scoped APIs. Portable bundles use type names and term slugs instead of environment-specific IDs. Diff before apply and require the exact reviewed digest; preserve unrelated metadata and never delete definitions. Export the destination separately before changing an existing definition. A digest approves the input bundle, not concurrent destination edits: pause definition edits during synchronization.
- Introduce the narrow `object.definition.write` machine scope for tenant-owned definition creation/update. Definition deletion still requires the existing server-wide scope. Reject references into another tenant. Do not change ordinary session/JWT definition-write policy.
- Stage public source records into an immutable, hashed manifest before applying. Bind by tenant, namespace, source scope, resource and original ID. Use a tenant/namespace advisory lock, per-record transactions and persisted progress. Preserve manual target edits as conflicts; never silently overwrite them.
- Import draft versions only. Preserve historical source dates, ordered attachment provenance and legacy URLs. Publishing, redirect activation and full URL reconciliation remain later reviewed steps.
- The `all` preset requires a completed, explicitly accepted sample with matching source scope, selected resources, mapping, definitions and pipeline. It has no sample cap. A reviewed mapping supplies source exclusions, including proceedings inside otherwise included libraries. Source edits must be frozen for the final paginated extraction; cursors are not a database snapshot.
- Permit the original News endpoint only behind an explicit DEBUG/dev/news-only compatibility flag. It omits original taxonomy IDs and site scope; mark those limitations in the manifest and forbid using that sample as the full-import acceptance gate.
- Include the classification prerequisite in this isolated branch, including object assignments and compatible legacy tag adapters. This does not declare the entire classification rollout or existing production backfill complete.

## Consequences

Dev can exercise real Article content immediately without deploying the source extension. The other four target types remain empty until the allowlisted six-resource legacy API is deployed and representative samples are verified. Independent legacy and v4 repository changes require coordinated review and deployment. Full import tooling is prepared, but production readiness still requires exclusions, reconciliation, representative sample acceptance and a staging rehearsal. No production action is authorized by this ADR.

## References

- [PRD-0034](../../prds/0034-simplified-legacy-content-import.md)
- [PRD-0031](../../prds/0031-shared-classification.md)
- [ADR-0046](0046-unified-articles-and-bounded-legacy-import.md)
- [Operator guide](../../../docs/legacy-editorial-import.md)

## Implementation evidence

The v4 preflight can retrieve reconciled source-status counts without fetching unpublished rows. Pagination verifies stable site scope and source ID ordering; dependency requests cannot return unrequested IDs. The sample gate explicitly rejects the legacy-News compatibility mode and requires a completed dev run. Fixture-based checks cover six resources mapping to five destination types and idempotent replay. Real multi-resource acceptance remains outstanding.

### Review hardening

Import application is lookup-only for taxonomy: missing approved source terms block the record; mapped IDs must belong to the expected facet. Prepare/govern the destination taxonomy separately as required by PRD-0034. Reimport conflict snapshots now cover relationships, metadata and slug, with destination reread after the authoring locks. Earlier experimental fingerprints fail closed as conflicts and must not be silently rebased. Definition bundles still contain the three article-kind core terms; legacy subject taxonomy is a separate reviewed preparation.

Canonical media imports use the reviewed mapping’s ordered `mediaClassificationIds`, validated against approved terms usable for media in the destination namespace before remote reads. Both images and fetched attachments receive those assignments; reused files retain existing classifications. Import does not create or approve terms. The media selection participates in the mapping fingerprint, so a revised reviewed selection is not skipped merely because source content is unchanged.

Initial API installation requires an explicitly selected tenant-owner principal with object read/definition-write and content read/write scopes; the local provisioning command creates an ordinary member and does not grant taxonomy ownership. Its definition-write flag alone is insufficient for creating the complete profile. Real API regression verifies a non-superuser owner can install the profile and obtain an empty subsequent diff while a member cannot create taxonomy types.

Reviewed exclusions precede replay/conflict short-circuits without deleting existing drafts. Column dependencies come from successfully processed author entries in the current frozen run. Article publication checks any referenced columnist is public at publication/schedule start. Conflict snapshots use stored classification identities rather than merge-resolved read projections; normal taxonomy maintenance must not fabricate editorial conflicts or rewrite historical assignments.
