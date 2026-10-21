---
id: ADR-0036
title: Theme-owned named text effects
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0027
supersedes: []
superseded_by: []
---

# Theme-owned named text effects

Store effects in PageTheme.text_outline_styles, exposed as textOutlineStyles to frontend code. Each stable key owns a display name and a validated, finite set of camelCase presentation properties, consistent with existing nested theme style dictionaries. Renaming a display name preserves widget references. Reserve only none for the intrinsic No outline choice. Dark and light are ordinary editable preset keys, retaining compatibility with existing widget selections.

Designer owns editing through its existing staged snapshot, publish and undo flow. Theme versions, clone and portable packages include the dictionary. Older snapshots restore an empty dictionary. Removing a preset is reversible in the editor and missing references render without an effect.

Use text shadows for all three effects: a ring of sixteen samples for contours, a blurred ring for gradient blur (a soft color-to-transparent halo), and an offset blurred ring for drop shadow. Angle is clockwise from right, offset is distance in CSS pixels. Thickness controls the ring radius; blur radius controls softness. This keeps effects on text, including nested headings and links, without adding duplicate text or blurring the letters themselves.

Same-as-text uses currentColor. Complement uses per-channel RGB inversion, evaluated from currentColor with CSS relative colors; it is not an HSL hue rotation. Fixed RGB values are stored as #RRGGBB. Theme CSS variables expose each effect to renderers; the editor also resolves directly for immediate display. No raw CSS is accepted. No outline remains available independently of the dictionary. Banner selectors list only theme-owned presets plus No outline; no hard-coded dark/light effects bypass the theme. Existing dark/light selections retain their stable keys. This extends ADR-0035 to theme-owned presets.

The migration adds an empty JSON dictionary without rewriting content. Deploy the backend migration before a publisher binary that selects the new column. Rolling the application back may leave the additive column in place; do not reverse the migration after styles have been authored without exporting those styles first.


## Default initialization — 2026-10-21

Following owner clarification, new themes start with editable Dark outline and Light outline definitions. Migration 0088 seeds only existing empty dictionaries and matching empty Designer draft dictionaries. Non-empty custom definitions and non-empty draft edits are preserved. The backfill is idempotent, uses conditional per-row updates inside the migration transaction and leaves sync/draft version counters unchanged because live and otherwise-empty draft defaults are initialized together. Historical version snapshots remain immutable. Reversing the migration retains styles rather than deleting potentially edited definitions.

Explicitly clearing an authored dictionary remains possible; the normal save path does not recreate deleted presets. Older imports that omit the field receive the new defaults. New frontend theme forms use the same default contract. Increment the generated CSS cache namespace so old cached styles cannot suppress the newly theme-owned outlines.
