---
name: eceee-cms-release-change-notes
description: Prepare and publish user-facing Change Notes for ECEEE CMS production releases, including screenshots and relevant videos. Use when preparing a production deployment or documenting a deployed CMS change; not for media-file version notes.
---

# ECEEE CMS release Change Notes

Prepare a traceable, user-facing Change Notes draft for the exact ECEEE CMS release. **Current implementation status:** PRD-0050 is draft; there is no dedicated resource, publication API/UI or automatic deployment gate. Do not claim a note was published or block a normal authorized deploy solely because the proposed gate is not implemented. Record the missing capability and preserve the draft/evidence. Once the supported resource exists, publication follows its reviewed authorization workflow. See [the consolidated status](../../../docs/cms-learning-and-collaboration.md).

## Workflow

1. Identify the exact pull request, immutable release tag, target commit, deployment status, and user-visible CMS changes. Inspect the actual diff and release summary; do not infer content from the tag name alone. If the release is not deployed and healthy yet, prepare the draft but do not publish it.
2. Decide whether the release changes user-visible CMS behavior. If not, record a concise reason no Change Notes entry is needed. Documentation-only and routine infrastructure-only releases do not need an entry.
3. Draft concise plain-language notes describing the change, affected CMS area, and user benefit. Include the exact release tag, commit, and deployment date when known. Avoid internal implementation detail unless it helps a CMS user.
4. Gather at least one representative, sanitized screenshot showing the changed UI or workflow. Include links to related instructional/demo videos when available; a video does not replace the screenshot. Do not fabricate evidence. If evidence is missing, produce a precise capture request and record the evidence gap.
5. Inspect the target checkout for the supported Change Notes UI/API contract, serializers, permissions, and media relationships. Invoke `$eceee-api-operations` for CMS requests and `$inspect-secrets-safely` for credential checks. Use the user's regular Chrome profile for authenticated browser work. Never write directly to the database or invent an endpoint.
6. If the current production CMS has no supported Change Notes resource or workflow, save/show the reviewed draft and report that production publication is blocked pending that CMS capability. Do not substitute a media record, page, or unrelated content type.
7. Before any production read or write, present a concrete plan: production origin and tenant, exact methods/endpoints or UI, release tag/commit, full note text, screenshot/video assets, public visibility, expected impact, and recovery limits. Obtain fresh owner authorization for that plan. If the release or evidence changes after authorization, prepare a new plan.
8. Publish only after the matching release has deployed and passed its health checks. Use the supported tenant-scoped CMS workflow. If screenshots/videos need upload or approval, include their exact destination and access level in the plan. Do not attach them to public pages unless explicitly requested.
9. Read the entry back and verify its release tag, commit, text, screenshot, and video links. Do not automatically retry an uncertain write; read first. If a separately authorized Change Notes publication/verification fails after a healthy deploy, report that publication as incomplete and preserve the healthy code release; do not roll it back or delete evidence automatically.
10. Report whether the note was published or blocked, its production identifier and evidence links when available, the verification result, and any remaining release-gate gap. Never expose credentials or private media URLs.

## Output

The draft should have a clear title, short user-facing summary, affected CMS area, release tag/commit, deployment date, screenshot with alt text/caption, and relevant video links. Keep the note faithful to the shipped behavior and the evidence captured from the deployed release.

## References

- [PRD-0050: CMS release Change Notes](../../../specs/prds/0050-cms-release-change-notes.md)
- Invoke `$eceee-api-operations` for supported CMS reads/writes.
- Invoke `$inspect-secrets-safely` before credential checks.
- Use `docs/ci.md` and `deploy/README.md` for the current deployment gates.
