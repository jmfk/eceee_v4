---
id: ADR-0065
title: Derived widget resolution and slot policies
status: accepted
date: 2026-11-07
related_prds:
  - PRD-0046
supersedes: []
superseded_by: []
---

# ADR-0065: Derived Widget Resolution and Slot Policies

## Context

Theme widget types already live in an append-only document on `PageTheme`; built-in widgets live in the code registry. Layouts use legacy allow and deny arrays, while nested containers have their own editor behavior. Derived types need one identity and one release history without copying executable widget code or weakening Django write validation.

## Decision

- Store derived types in the existing theme widget document with their own UUID, display metadata, draft and numbered releases. A derived release records one `base_type`, an exact `base_version` for a theme-authored base, validated defaults and policies keyed by inherited slot name. The base identity cannot change after first publication. A derived type cannot be a base.
- Resolve a derived instance in its owning effective theme and tenant. Its saved `type_version` selects the derived release. Resolution delegates schema, rendering and slot structure to the recorded base, retaining the derived identity for policy checks. Built-in bases use deployed code; theme-authored bases use their pinned release.
- Use a shared effective slot-policy contract: `mode: inherit | allow | none` and `allowed_widget_types` for `allow`. `inherit` retains the base policy; `allow` selects exact stable type IDs within the base's permitted set; `none` permits no children. Required slots cannot use `none`. Existing layout `allowed_widget_types` and `disallowed_widget_types` are adapted to this contract without changing stored data. An absent or empty legacy allow list means unrestricted, as before.
- Match legacy `*` and `namespace.*` patterns against the actual type ID only. Exact IDs never match a base, derived type or sibling by inheritance. Deny rules take precedence. New explicit selections use exact type IDs, never patterns.
- Apply policies to direct children at each slot boundary. Django validates page and object writes, imports and theme publication; frontend pickers and interactions use the same effective rules for feedback. Rejected writes must fail before persistence. Historical instances retain their pinned policies; mutable layout restrictions require compatibility checks against existing content before publication.
- Keep dependencies and released policies in the existing theme history and transfer document. A missing base or exact release is an error; no fallback to latest or a similarly named type is allowed.

## Rationale

The existing theme document already supplies atomic draft publication, immutable releases, tenant ownership and portable history. Explicit policy states remove the empty-list ambiguity while preserving current layout payloads.

## Consequences

- Django write validation remains part of the implementation even when authoring and rendering changes are TypeScript-first.
- Existing layouts and built-in widgets keep their current semantics until explicitly edited.
- The first implementation must verify rendering, editing, import, upgrade and restore boundaries against the same release identity.

## Alternatives Considered

- Copy a base widget implementation into each derived type: rejected because fixes would diverge.
- Use an independent derived-type table or registry: rejected because publication and transfer would gain a second source of truth.
- Treat empty allow lists as blocked: rejected because current layouts use them for unrestricted slots.

## Links

- [PRD-0046](../../prds/0046-derived-widgets-and-slot-restrictions.md)
- [ADR-0040](0040-theme-widget-revisions.md)
