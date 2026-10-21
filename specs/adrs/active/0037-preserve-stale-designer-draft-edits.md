---
id: ADR-0037
title: Preserve edits in stale Designer drafts
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0027
supersedes: []
superseded_by: []
---

# Preserve edits in stale Designer drafts

A changed Designer draft can become stale when another workflow updates the live theme. Users must still be able to save further theme setting edits, including new text outline presets, into that separate draft. Saving does not publish, rebase, overwrite the live theme, or advance the draft's base live version.

Keep the optimistic draft-version check and row lock when saving. Keep the live-version check when publishing. An outdated draft cannot be published over newer live changes. The UI enables Save draft for local edits even when the live base is stale, and explains that publication remains blocked. Existing discard/export workflows remain available; no draft is discarded automatically.

This narrows the staleness rule in ADR-0004: live staleness prevents publication, while an obsolete draft version still prevents concurrent draft overwrites. Other staged operations retain their existing validation and staleness rules.

Verification must show that an outline saved in a stale draft survives reload, previous draft edits remain, live data and the draft base version stay unchanged, concurrent writes using the older draft version fail, and publication remains rejected.
