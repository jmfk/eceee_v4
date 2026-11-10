---
id: PRD-0050
title: CMS release Change Notes with visual evidence
status: draft
locked: false
created: 2026-11-10
related_adrs: []
---

# PRD-0050: CMS release Change Notes with visual evidence

## Problem

Production deployments can change CMS behavior or workflows without a
consistent, user-facing record of what changed. Release notes need to explain
the change and show the relevant interface, with instructional videos when
they exist. The current deployment gate verifies code, backups, migrations,
services, and health, but it does not require a Change Notes update.

## Goals

- Require a Change Notes entry for every production release that changes
  user-visible CMS behavior, interface, or workflow.
- Include concise user-facing descriptions and representative screenshots;
  include relevant tutorial or demonstration videos when available.
- Associate each entry with the exact deployed release tag and commit.
- Integrate preparation and publication into the production deployment flow.
- Provide a Codex skill to draft, review, attach evidence to, and publish the
  Change Notes entry through supported CMS workflows.

## Non-Goals

- Publish notes for changes that have no user-visible CMS effect, such as
  documentation-only edits or routine infrastructure maintenance.
- Publish a Change Notes entry before the corresponding release is healthy in
  production.
- Automatically expose private customer data, credentials, internal logs, or
  unredacted browser state in screenshots, captions, or videos.
- Treat a passing deployment health check as proof that the Change Notes entry
  was published and verified.

## Users and Use Cases

- **CMS user:** learns what changed after a production release and can inspect
  the updated interface or watch a related walkthrough.
- **Release owner:** prepares and reviews the Change Notes content and its
  visual evidence before deploying.
- **Maintainer:** verifies that the entry corresponds to the exact release that
  is running in production.
- **Codex agent:** drafts a Change Notes entry from the reviewed PR/release
  summary and selected screenshots/videos, then publishes it only through the
  authorized CMS workflow.

## Requirements

### Release eligibility and deployment gate

- Every production release containing user-visible CMS changes requires a
  Change Notes entry. The release plan identifies whether the requirement
  applies and records the reason when it does not.
- The deployment workflow must refuse to start a release requiring Change Notes
  when its reviewed draft and required evidence are missing.
- A Change Notes entry is published only after the exact tagged release has
  deployed and passed its production health checks.
- A deployment is not reported complete until the Change Notes entry has been
  read back and verified against the exact deployed tag and commit.
- If the application deploy succeeds but Change Notes publication or
  verification fails, report the deployment as incomplete and preserve the
  healthy application release. Do not automatically roll back application code
  or retry an uncertain Change Notes write.

### Entry content and evidence

- Each entry names the release tag, deployed commit, deployment date, affected
  CMS area, and user-visible change in plain language.
- Each entry includes at least one representative screenshot for a
  user-visible interface or workflow change. The screenshot must show the
  production behavior after deployment, use sanitized data, and include useful
  alternative text or a caption.
- Include links to relevant instructional or demonstration videos when they
  exist. A video does not replace the required screenshot.
- Evidence must be traceable to the release and must not contain secrets,
  unrelated browser content, or private customer data.
- Keep the approved draft and final published entry aligned. Changes to the
  release after review require the note and its evidence to be reviewed again.

### Codex Change Notes skill

- The repository provides an auto-discoverable Codex skill for preparing a
  Change Notes entry from the exact reviewed PR/release and its screenshots or
  videos.
- The skill inspects the actual diff and deployment summary, drafts concise
  user-facing wording, checks that required evidence is present, and displays a
  reviewable preview before publication.
- The skill publishes through the supported tenant-scoped CMS API or UI; it
  does not write directly to the database or invent an unsupported endpoint.
- Production publication requires a fresh, concrete authorization naming the
  exact release, entry, media, destination, and public visibility.
- After publication, the skill reads the entry back and reports its identifier,
  release association, evidence links, and verification status without
  exposing credentials or private media URLs.

## Acceptance Criteria

- [ ] A release with a user-visible CMS change is blocked before production
  deployment if its Change Notes draft or required screenshot is missing.
- [ ] A release with no user-visible CMS change records why no Change Notes
  entry is required.
- [ ] The published entry identifies the exact production tag, commit, and
  deployment date.
- [ ] A reviewer can see a representative sanitized screenshot and open any
  relevant instructional videos from the entry.
- [ ] Publication happens after successful production health checks and before
  the deployment is reported complete.
- [ ] If publication fails or its outcome is uncertain, the release is reported
  incomplete; the tool reads state before considering another write and does
  not roll back the healthy application release automatically.
- [ ] The Codex skill presents the exact entry and evidence for review and does
  not publish before fresh production authorization.
- [ ] The skill verifies the saved production entry against the deployed tag
  and commit.

## Constraints

- Production deployments use immutable release tags and the existing backup,
  lock, migration, restart, and health-check gates.
- Screenshots and videos may be public media; their access level and destination
  must be visible in the approval plan before publication.
- Existing media uploads enter a review queue and require supported approval
  metadata. Release evidence must use those existing workflows until a
  dedicated Change Notes media contract is implemented.
- Current repository inspection found no dedicated CMS release Change Notes
  resource or Codex skill. Existing media-file version notes are a separate
  feature and do not satisfy this requirement.

## Implementation Notes

- Inspect the production-facing CMS routes and deploy scripts before selecting
  the Change Notes data model or publication order.
- The current `make prod-deploy` health gate is the integration boundary; do
  not add a post-deploy public write until its authorization, retry, and
  recovery behavior is specified.
- A future implementation decision about the Change Notes API, media
  relationship, or deployment failure state should be recorded in an ADR.

## Linked ADRs

- None yet

## Completion Evidence

- None yet
