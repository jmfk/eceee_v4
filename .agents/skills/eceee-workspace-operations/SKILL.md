---
name: eceee-workspace-operations
description: Operate ECEEE instruction-library metadata, service-account Inbox and bug reports, Kanban boards/cards, and the machine principal's own profile through tenant-bound API keys. Does not impersonate users or administer account security.
---

# ECEEE workspace operations

Read [the verified surface map and API contract](../../../docs/cms-learning-and-collaboration.md) first. Discover current routes, serializers and relevant frontend adapters before building a payload. Use `$eceee-api-operations` and its existing `eceee_api.py` helper for requests, with an explicit tenant and environment profile. Use `$inspect-secrets-safely` for credential checks. Source availability does not mean a production endpoint is deployed.

## Identity and authorization

Reuse the correct existing machine key; never rotate or create a second credential to obtain access. The key acts as its stored principal, not an arbitrary human. Do not accept an actor/user ID as permission to read somebody else's private Inbox, threads or profile. Appropriate scopes, key tenant, live membership, board access and support/publisher roles are separate checks. A 403 is a permission result, not a reason to widen access. Scope grants and role changes require explicit owner instructions and the supported human-admin workflow; machine keys cannot grant themselves capabilities.

## Choose the existing contract

- Instructions: `GET /support/instructions/` and detail; authorized state PATCH uses `support.publish`. For upload/publication, use `$eceee-instructional-video-publisher`, never `/media/upload/`.
- Inbox: `GET /support/inbox/` uses `support.read`; personal archive is `PATCH /support/inbox/<uuid>/` with `archived` under `support.write`. Follow pagination. This is the principal's Inbox only.
- Reports/messages: `POST /support/threads/` with `kind=bug` or `question`, title, body, sanitized `location`, recipients and stable `requestId`. Optional bug video is uploaded first to `/support/videos/` with `purpose=bug`; decoded length must be at most five seconds. Replies are `POST /support/threads/<uuid>/` with body, attachment IDs and request ID. Status changes are PATCH. Existing participant/support-role checks still apply. Sending messages, notifications or reports requires an explicit user request for that communication.
- Kanban: `/kanban/boards/`, `/columns/`, `/cards/`, `/comments/`, `/attachments/`, `/workspace/` already exist. Use `kanban.read` / `kanban.write`, live board membership, and the current action serializers. Read revisions first; preserve fields outside the request. On 409, read and reconcile rather than overwriting. Archive rather than delete when that is the requested outcome; do not automatically delete anything.
- Self profile: `GET /utils/current-user/` with `profile.read`; PATCH `preferredLanguage` (`sv-se`, `en-us` or empty) with `profile.write`. Photo GET/PUT/DELETE at `/utils/profile-photos/<principal-id>/`; PUT uses multipart `file`. Other people's profiles, passwords, MFA, email/identity changes, role grants and account administration are outside this contract.

Paths above are relative to `/api/v1/`. Use camelCase JSON/multipart metadata at the HTTP boundary; Python serializers internally use snake_case. Read a resource before changing it; use `--data-file` for bodies. Do not auto-retry uncertain non-idempotent writes. Keep playback/download URLs, attachments, private message content and credentials out of logs/reports. Preserve all unrelated content. Do not perform production reads or writes without the authorization required by the environment's API workflow.
