---
id: ADR-0033
title: Widget editor session and field ownership
status: accepted
date: 2026-10-20
related_prds:
  - PRD-0025
supersedes: []
superseded_by: []
---

# ADR-0033: Widget Editor Session and Field Ownership

## Decision

A widget form session is identified by page/object, version, widget type/ID and nested slot path. Identity changes create a new form; value changes preserve field DOM and editor instances. Field edits synchronously update the draft and notify its existing owner. Validation remains debounced. External hydration is silent and local-origin events are excluded explicitly, without elapsed-time heuristics.

Rich-text fields use the existing editors through a field adapter, preserving the HTML string contract. Headline fields use inline formatting; body fields allow blocks. Nested fields report through their parent field instead of bypassing its save buffer.

## Rationale

This repairs lifecycle and ownership at the existing form boundary without adding a store or changing canonical page persistence. ADR-0015 revision checks, three-way conflict handling and atomic rich-text conflict values remain unchanged.

## Consequences

- Save sees the latest input and unrelated fields retain their editing state.
- Editor hydration must not emit onChange or normalize untouched existing content.
- Browser regressions supplement component mocks for selection and undo behavior.

## Alternatives Considered

- Broad state rewrite or CRDT/OT: unnecessary for these verified lifecycle defects.
- More timing guards or disabling all rerenders: obscures external changes and does not ensure save correctness.

## Links

- [PRD-0025](../../prds/0025-stable-widget-field-editing.md)
- [ADR-0015](0015-revision-based-page-collaboration.md)
