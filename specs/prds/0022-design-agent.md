---
id: PRD-0022
title: Design Agent for Themes, Designer, and Layout
status: draft
locked: false
created: 2026-10-14
related_adrs:
  - ADR-0025
  - ADR-0026
  - ADR-0027
  - ADR-0028
  - ADR-0029
  - ADR-0030
  - ADR-0031
---

# PRD-0022: Design Agent for Themes, Designer, and Layout

## Problem

Themes, the restricted Designer, and the Layout Editor operate on overlapping parts of the same theme-owned design system but serve different users. Designers need a specialized agent that understands the shared draft, layout tree, styles, preview fixtures, and render constraints without inheriting the broader authority of a theme administrator or CMS editor.

## Goals

- Provide a named Design Agent variant inside the Designer and Layout Editor.
- Keep one conversation and queue while the user moves between Designer, Layout, and Preview surfaces for the same theme draft.
- Let the agent safely create and revise layouts, design tokens, permitted theme styles, assets, and preview documents.
- Preserve theme snapshots, draft conflicts, render parity, and explicit publication.
- Let tenant administrators use the same variant in a deliberately restricted design context even when they hold broader permissions.

## Non-Goals

- Replace the advanced Theme Editor or expose every theme field to designer-only users.
- Let the Design Agent modify real pages or objects; it may edit only theme-owned preview documents.
- Create new widget implementation types or change repository code.
- Couple mutable theme records, assets, or histories across tenants.
- Publish a Designer draft merely because a requested design looks valid.

## Users and Use Cases

- An assigned designer asks for a calmer mobile header and receives a plan, draft changes, responsive previews, and a recoverable checkpoint.
- A designer creates a conference-program layout with valid stable node identifiers and slots, then tests it with long Swedish content.
- A designer imports an authorized page or object into theme-owned preview content and changes only the independent preview copy.
- A tenant administrator opens the advanced Theme Editor, explicitly invokes Design Agent, and receives the narrower design capability profile by default.

## Requirements

### Profile and scope

- The Design Agent profile is available only when the user can design the selected theme.
- The session binds to one tenant and one theme; changing theme starts or explicitly retargets a session.
- The profile exposes only tools authorized for the current user's Designer or theme-admin role.
- An administrator in Designer receives the Design Agent tool set unless they explicitly enter the Theme/Admin profile.
- The current theme, shared Designer draft version, live sync version, selected layout, selected node/style target, viewport, and dirty state are visible.

### Theme and Designer capabilities

- The agent can read the complete theme contract needed to preserve unrelated fields.
- Designer-only mutations use the existing shared `ThemeDesignerDraft` and assignment permissions.
- The first release supports layouts, special pages, palette colors, fonts, permitted spacing/style values, theme assets, and Designer preview documents.
- Advanced theme fields such as arbitrary custom CSS, full component templates, image style templates, activation/default state, import/export, and remote transfer require the Theme/Admin profile unless separately allowlisted.
- The agent creates a named checkpoint or uses the Designer recovery workflow before a coherent high-impact theme mutation.
- Full-theme updates begin from the latest editable server representation and preserve unknown keys, `stable_key`, ownership, assets, and preview references.

### Layout capabilities

- The agent can create, copy, archive, label, and describe layouts within documented limits.
- It can add, update, move, and remove allowed layout nodes using stable identifiers.
- It can create and configure slots, styles, responsive overrides, semantic tags, class names, and special-page bindings through validated domain operations.
- It must preserve required layouts, referenced slots, default-layout rules, usage constraints, maximum nodes, maximum depth, and supported style properties.
- Each mutation batch validates the server theme-layout contract before it is accepted.

### Preview and visual review

- The agent can create and edit theme-owned page and object preview documents but cannot publish or route them as live content.
- Preview source import strips identity, hierarchy, routing, inheritance, and publication state according to ADR-0009.
- The agent renders at least mobile, tablet, and desktop for responsive changes.
- Visual review includes overflow, clipping, hierarchy, contrast, long content, empty slots, nested widgets, image suitability, and accessible semantics.
- Affected widgets and layouts remain in parity across edit components, standalone React rendering, deterministic fixtures, and existing public Django semantics.
- The final proposal shows structural and visual diffs plus validation results.

### Draft, conflict, and publication behavior

- Every write carries the reviewed draft version and fails on stale draft or live-theme state.
- The agent re-reads and replans after a conflict; it never retries by overwriting the current draft.
- Agent changes remain in the shared Designer draft until the user explicitly publishes through the existing workflow.
- Publication presents the affected theme subsystems, preview evidence, validation, current draft version, and recovery point.
- Discard and undo use existing Designer and theme-version behavior and remain explicit user actions.

## Acceptance Criteria

- An assigned designer can ask the agent to create a valid layout, see it appear in the shared draft, and preview it at three viewport classes without changing the live theme.
- The same agent session follows the designer from Theme Designer to Layout Editor and retains the accepted plan and queue.
- A designer-only user cannot invoke page, object, advanced theme, settings, credential, or repository tools.
- An administrator using Design Agent receives the restricted profile by default.
- A stale draft produces an explained conflict and no overwritten fields.
- Required layouts, referenced slots, unsupported style values, invalid nesting, excessive depth, and duplicate keys are rejected before persistence.
- A representative changed layout passes registry parity and the relevant editor-preview, standalone-render, and public-render checks.
- Publication requires a distinct reviewed user action and creates or identifies a recovery point.

## Constraints

- `ThemeDesignerDraft` remains the single shared design draft for a theme.
- `PageTheme` remains the design source of truth; no agent-specific theme representation is introduced.
- Theme preview documents remain embedded in the theme snapshot and independent of live content.
- Editor and render implementations stay separate; the agent cannot bypass their adapters and validators.
- Images must respect current storage, sizing, DPR, and immutable draft-asset rules.

## Implementation Notes

- Deliver this PRD before the broader CMS Content Agent because it is the thinnest complete vertical journey and exercises profiles, tools, queue, steering, conflict handling, previews, and recovery.

## Linked ADRs

- [ADR-0025: One agent runtime with capability-scoped profiles](../adrs/active/0025-capability-scoped-agent-profiles.md)
- [ADR-0026: Domain tools preserve canonical CMS workflows](../adrs/active/0026-domain-tools-preserve-canonical-workflows.md)
- [ADR-0027: Durable PostgreSQL runs with cooperative steering](../adrs/active/0027-durable-runs-and-cooperative-steering.md)
- [ADR-0028: Provider-neutral context packs and public reasoning summaries](../adrs/active/0028-provider-neutral-context-and-transparency.md)
- [ADR-0029: Tenant BYOK through capability-aware provider adapters](../adrs/active/0029-tenant-byok-provider-adapters.md)
- [ADR-0030: Human-controlled publication and recoverable mutations](../adrs/active/0030-human-controlled-publication.md)
- [ADR-0031: Eval-first prompt optimization](../adrs/active/0031-eval-first-prompt-optimization.md)

## Completion Evidence

- None yet.
