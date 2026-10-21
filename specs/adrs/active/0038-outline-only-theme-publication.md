---
id: ADR-0038
title: Publish theme outlines independently of other Designer draft changes
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0027
supersedes: []
superseded_by: []
---

# Publish theme outlines independently

Saving a Designer draft preserves outline work but does not make it available in the page editor, which uses the published theme. Provide an explicit **Publish outlines** action inside the outline section. It saves local setting edits to the draft, then publishes only outline changes. It does not publish typography, preview content, layouts, palette changes or other draft fields. Whole-draft publication retains its existing live-version gate.

Lock the tenant, theme and draft, validate designer assignment, and require the exact draft and current live version sent by the client. For a stale draft, obtain the original outline dictionary from the immutable theme version at the draft base sync version. Historical versions predating the outline field use the initialized dark/light default contract. If the base version is unavailable, reject the operation instead of guessing.

Merge per-key differences from that base to the draft into the current live dictionary. Preserve independent live additions/edits. Reject a key changed differently in both places, including conflicting deletions. A normal theme save records a recoverable complete version and invalidates generated CSS. Keep unrelated draft edits intact; do not advance a stale draft's base unless it now exactly matches live. This allows publication of outlines without silently rebasing or publishing older unrelated work.

Page editing, its scoped CSS and preview refresh published outline definitions by effective theme ID. Share the query across consumers, invalidate it after publication, and refetch on return from another tab. Merge only published outline data into the editor's existing theme snapshot, preserving other local settings and all page edits. Public rendering continues to load published theme data only; no saved Designer draft leaks into public content.

Tests cover scoped publication, live/draft version conflicts, per-style merge conflicts, designer assignment, retained draft work, theme history, and editor refresh after returning from Designer.
