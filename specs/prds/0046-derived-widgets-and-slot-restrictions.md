---
id: PRD-0046
title: Derived widgets with single-level inheritance and slot restrictions
status: started
locked: true
created: 2026-11-07
related_adrs:
  - ADR-0065
---

# PRD-0046: Derived Widgets and Slot Restrictions

## Problem

Designers need reusable container widgets with different editorial purposes. A general Two Columns widget might accept many kinds of content, while an Article Columns widget should accept article content on the left and supporting content on the right. These restrictions must apply to slots inside widgets as well as slots in page layouts.

Copying a widget's implementation for each purpose would duplicate behavior and make maintenance harder. Instance-specific restrictions would require repeated configuration and would not provide a reusable type that layouts can explicitly allow.

## Goals

- Create named derived widget types under Designer → Theme → Widgets.
- Reuse one base widget's implementation through single-level inheritance.
- Configure allowed child widget types separately for each inherited slot.
- Apply consistent slot restrictions to layouts and nested widgets across editing and server validation.
- Preserve theme ownership, versioned publication and existing content.

## Non-Goals

- Multiple inheritance or deriving a widget from another derived widget.
- Copying or executing arbitrary React/JavaScript implementations stored in the database.
- Adding, removing or renaming inherited slots; changing the base field schema or renderer.
- Per-instance overrides of derived-widget slot policies.
- Automatic conversion or bulk upgrades of existing widgets.
- New query builders, conditional policy expressions or widget-category permission systems.
- Changing page-to-page content inheritance; type inheritance is a separate concept.

## Users and Use Cases

- A theme designer creates Article Columns from Two Columns, allowing Heading, Content and Image in the left slot and Fact Box and Related Articles in the right slot.
- A theme designer allows Article Columns in a layout's main slot without also allowing unrestricted Two Columns.
- An editor selects Article Columns by name and sees only the permitted widgets when editing each inner slot.
- A theme designer publishes a stricter new version while existing content keeps its previous version until explicitly upgraded.

## Requirements

### 1. Authoring and ownership

- Extend the existing Theme → Widgets area with a Create from existing widget action. Keep derived types in the same list as other theme-owned widget types, with their base identified.
- Creating a derived widget requires the existing Designer authoring permissions. Editors using a widget cannot change its type definition or restrictions.
- Give each derived type its own stable identity, name, description, draft and published versions, scoped to the owning theme and tenant.
- Save through the existing shared theme draft and publish atomically with the theme. Unpublished types are available only in authorized Designer previews.
- Allow the designer to edit the name, description, valid configuration defaults and slot restrictions. Show inherited fields and slot names clearly.
- Use the existing compact ECEEE application design patterns and accessible keyboard interactions.

### 2. Single-level inheritance

- Every derived type references exactly one non-derived base widget. Reject derived bases, self-reference, cycles and missing or inaccessible bases, including through APIs and imports.
- Support existing built-in container widgets, including Two Columns. Non-derived theme-authored widgets may also be bases where their existing capabilities permit it; this does not add child slots to widgets that have none.
- Inherit the base renderer, configuration schema, validation, slot structure and supported behavior. Do not create a separate copied implementation.
- Defaults must validate against the inherited schema. They initialize new instances; they do not lock fields or overwrite saved values.
- Treat the base identity as fixed after the derived type's first publication. A different base requires a new derived type.
- For a versioned theme-authored base, bind each published derived release to an exact published base release. Later base publication must not silently alter that binding.
- Built-in bases continue to follow the application's deployed implementation and compatibility rules. Pinning a derived release does not freeze executable application code.

### 3. Slot policies

- Use one shared slot-policy contract for layout slots and widget slots, with explicit boundary adapters where existing payload naming differs.
- For each inherited widget slot, offer three clear states: inherit the base policy, allow selected widget types, or allow no widgets. Do not overload an empty list to mean both unrestricted and blocked.
- A derived policy may narrow the base policy but cannot expand it. Validate selected types against the base's effective allow/deny rules; inherited capacity and required-slot constraints remain effective.
- Reject a policy that makes the slot's required-content constraints impossible, such as blocking all children in a required slot.
- Allowed selections may include built-in widgets, available non-derived theme widgets and other derived types. A derived child in a slot is composition, not another inheritance level.
- Explicit type selections match stable type identities. Allowing a base type does not implicitly allow its derived types, and allowing a derived type does not allow its base or siblings.
- Preserve existing wildcard behavior for existing policies. Any supported wildcard must have documented, deterministic matching against actual type identities, without implicitly traversing inheritance.
- Policies apply to direct children of the slot. Each nested container independently enforces its own inner-slot policies; an outer layout policy does not automatically restrict every descendant.
- Rule configuration must not contain instance content. Children remain ordinary widget instances in the existing content tree.

### 4. Editing and enforcement

- Show published, active derived types as separate choices in page and object widget pickers, filtered by the destination slot.
- Apply the same effective policy to adding, replacing, dragging, moving, duplicating, copying/pasting and predefined-widget insertion, at any supported nesting depth.
- Enforce the policy authoritatively on server writes, including machine API and import paths. Client filtering alone is insufficient.
- Validate the resolved layout and pinned widget definitions in the correct effective-theme and tenant context. Reject unknown, missing or inaccessible type references explicitly.
- Reject invalid operations without partial mutation or loss of the source widget. Identify the destination slot, rejected type and relevant restriction in the error.
- Render derived widgets through the base implementation consistently in editing, previews and public rendering. Preserve derived identity for policy matching and retain the base's existing styling and behavior.

### 5. Publication and existing content

- Reuse append-only published widget releases and pinned instance versions. New instances use the active published release; existing instances retain their saved release.
- Publishing a tighter derived policy must not silently remove children, rewrite instances or make instances pinned to an older release adopt the new policy.
- Explicit upgrade preview must identify incompatible children by slot and type, retain their data and prevent saving an invalid upgraded instance until the editor resolves the conflicts.
- Existing layouts and built-in widgets retain their current behavior unless their policies or types are explicitly changed. Changes to mutable layout policies must report affected existing content and require resolution before incompatible content is published; never discard it automatically.
- Archive released derived types instead of deleting their history. Hide archived types from new-instance choices while preserving existing exact-version reads, edits and copies under the existing archival rules and destination policies.
- Include derived definitions, releases and base dependencies in theme history, export/import, synchronization and supported transfers. Preserve references or reject an incompatible transfer before mutation; never silently substitute a different base or latest release.
- Validate theme switches and restores against retained references using the existing compatibility guarantees.

## Acceptance Criteria

1. A designer creates Article Columns from Two Columns, saves and reloads its draft, and publishes it with distinct left/right allowed-widget lists.
2. A layout allows Article Columns specifically. Editors can insert Article Columns there but cannot insert its unrestricted base or a sibling derived type.
3. Within Article Columns, each picker offers only the permitted direct children. A permitted nested container applies its own policies to its children.
4. Disallowed add, replace, drag, move, duplicate and paste operations fail without losing content. Direct API writes and imports cannot bypass the same restrictions.
5. Creating a derived type from another derived type, changing a released type's base, broadening a base restriction or referencing another tenant's definition is rejected.
6. Inherit, selected-types and no-widgets states survive save/reload and behave consistently in layout and widget policy resolution. Impossible required-slot policies are rejected.
7. Derived widgets preserve the base's fields, rendering, responsive behavior and existing styling in page/object editing, preview and public output.
8. Publishing version 2 with tighter restrictions leaves a version 1 instance and all of its children intact. An explicit upgrade reports incompatible children and cannot save until they are resolved.
9. Updating a versioned theme-authored base does not change derived releases pinned to its previous release. Built-in base compatibility remains governed by application releases.
10. Archival, theme export/import, supported transfers and restore preserve published identities, exact versions and required dependencies, or fail clearly before mutation.
11. Existing content using unchanged layouts and built-in widgets remains editable and renderable without conversion.

## Constraints

- Extend the existing theme widget document, draft and publication boundaries rather than introducing a parallel widget registry or release store.
- Preserve tenant isolation, authoritative validation, inherited configuration naming contracts and non-destructive content handling.
- Prefer TypeScript for new behavior where the current stack supports it. Before implementation, identify any existing Django write-validation dependency that requires compatibility changes and explain that scope.
- This PRD extends the child-slot non-goal of PRD-0029 only through derivation from existing slot-capable bases. It does not introduce arbitrary slot authoring for HTML/Mustache widgets.

## Implementation Notes

- Implementation started on 2026-11-07. The existing Django page/object write validation remains authoritative and requires compatible changes alongside TypeScript editor and renderer work.
- The inheritance-resolution and shared slot-policy contract is recorded in ADR-0065.

## Linked ADRs

- [ADR-0065: Derived widget resolution and slot policies](../adrs/active/0065-derived-widget-slot-policies.md).
- Existing constraints: [ADR-0040: Theme-owned widget releases](../adrs/active/0040-theme-widget-revisions.md) and [ADR-0041: Shared widget contracts](../adrs/active/0041-shared-widget-contract-source.md).
- Related prior scope: [PRD-0029: Theme-owned versioned widget types](0029-theme-widget-types.md).

## Completion Evidence

- Derived widget drafts/releases, exact base resolution, slot policies, Designer controls, editor filtering and public rendering are implemented on the `codex/derived-widget-slot-policies` branch.
- Focused contract checks: 57 database-free Django tests, 49 Designer/rendering Vitest tests and 26 slot interaction Vitest tests passed; frontend production build and TypeScript check passed.
- The database-backed Designer workspace API test and the backend-test target's 89 taxonomy governance checks passed on PostgreSQL. Page/object write and transfer integration tests remain for the PR review gate.
