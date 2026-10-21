---
id: ADR-0041
title: Shared declarative built-in widget contracts with comparison-only Node validation
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0028
supersedes: []
superseded_by: []
---

# ADR-0041: Shared Widget Contract Source

## Context

The frozen pilot in ADR-0039 establishes 51 API cases, the complete render catalog and separate PostgreSQL/rendering gates. PRD-0028 requires a single language-neutral source and a manifest build that does not initialize Django. The four pilot configuration models and their nested FormField model contain no custom validators or default factories; they use strings, booleans, literals, nullable values, dictionaries, lists, required fields and minimum lengths.

## Decision

- Keep a small package at `backend/widget_contracts/` so the existing backend image includes it without an extra deployment/install mechanism. Its Python imports do not import Django. Its Node entry points have no npm dependencies, server, environment files or database access.
- `render_catalog.json` version 1 owns presentation names, CSS, CSS variables, full layout-part metadata, variants and default special pages for all 25 built-in code widgets. A decorator applies those values before Django registers the existing classes; the old duplicate declarations are removed. The manifest remains format version 2 and byte-identical. Node generates/checks it; the existing Django command remains a compatibility check of the same source.
- `pilot_models.json` version 1 owns the five pilot model declarations, including explicit Python names and wire aliases, annotations, defaults, descriptions, field constraints and UI metadata. The Python adapter builds Pydantic classes from those declarations and re-exports existing names from the original widget modules. Non-pilot configuration models and runtime render/data behavior remain Python-owned.
- Node evaluates the same declarations for schema/default/UI output and direct model validation. It implements only the pilot's inventoried annotation set; it is a comparison candidate, not the authoritative production validator or an HTTP server. Pydantic continues to validate CMS writes and existing API requests. No permanent request-time double validation is added.
- The transport comparison adapter explicitly reproduces existing DRF snake/camel conversion, alias collision order, error envelopes and the known Headline `headerLevel` parser defect. The direct model evaluator accepts `headerLevel` correctly. Keeping the parser defect for comparison is not approval to carry it into a replacement API.
- Run the same frozen cases against actual Node evaluation, with no reference-response imports. Compare exact output using the existing comparator. Keep real authentication, tenant, CSRF and persisted-state checks in Django; anonymous fixtures in the Node adapter test policy shape, not authentication enforcement.
- Keep `candidateParity: not_supplied` for a replacement backend. Report the narrower `contractCandidate` result separately with the tested source commit, fixture hash, runtime, differences and comparison-only scope. Desktop/mobile rendering and real save/reload remain mandatory in the complete pilot command.
- Theme-authored widgets remain tenant/theme-owned data with pinned revisions. This static catalog never absorbs theme definitions from PR #260.

## Consequences

- Developers can regenerate/stale-check all current render metadata with Node alone. Neither Python nor TypeScript maintains a second copy of the moved widget declarations.
- JSON Schema alone is insufficient to model Pydantic coercion. The Node adapter's compatibility is checked against frozen observations and an additional field-value matrix, including nested form errors. Evidence applies to the tested scope, not every conceivable JSON input or the complete CMS.
- Model or rendering contract changes require updating the shared source and both adapter tests. Unsupported extensions must be implemented and verified before they are used; Pydantic remains the runtime authority.
- Existing routes, authentication, storage casing, persistence, revisions and publication ownership are unchanged. There are no migrations, provider changes, published ports or deployments.

## Alternatives

- Independently maintain Python models and JavaScript validators: rejected because it creates competing schema owners.
- Move only a generated manifest snapshot: rejected because regeneration would still require Django.
- Introduce an API framework or cut over validation now: deferred until explicit replacement parity and the remaining retirement gates are satisfied.

## Links

- [PRD-0028](../../prds/0028-framework-independent-content-contract.md)
- [ADR-0039](0039-frozen-pilot-behavior-baseline.md)
- [Package and commands](../../../backend/widget_contracts/README.md)
