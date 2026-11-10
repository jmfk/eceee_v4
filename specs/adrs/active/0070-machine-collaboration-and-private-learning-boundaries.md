---
id: ADR-0070
title: Machine collaboration and private learning boundaries
status: accepted
created: 2026-11-10
related_prds:
  - PRD-0051
---

# ADR-0070: Machine collaboration and private learning boundaries

## Context

The same hashed, revocable tenant-bound machine key mechanism already serves CMS data and Kanban. Support APIs currently reject every machine identity. Help is compiled from Markdown; instruction videos use separate private support storage.

## Decision

Extend existing API authorization rather than create parallel CRUD endpoints or a second service. Add support read/write/publish and self-profile read/write scopes. Scopes do not grant human support/publisher roles or board membership. Continue using the authenticated principal for senders, owners and personal Inbox filters; never accept an arbitrary actor/user parameter. Keep role assignment, password/reset, authentication and key-management endpoints blocked to machines. No existing key is rotated or granted additional access implicitly.

Help Markdown remains code-owned. Manuscripts own executable narration/actions. Rendered previews/finals are artifacts; private instruction publication references the relevant help guide ID and language. It does not create public media records. Help supports private linked films; it must not publish signed playback URLs as permanent assets.

PRD-0050 remains a separate planned release Change Notes resource. Its proposed deploy/publication gate is not enabled until the resource and reviewed integration exist.

## Consequences

Django compatibility changes preserve existing models, roles, quotas, validation and notification effects; TypeScript retains help/video ownership. A service principal needs both key scopes and explicit publication/support roles for privileged operations. Personal user delegation and global account administration require separate decisions. Production API operation and deployment remain separately authorized.
