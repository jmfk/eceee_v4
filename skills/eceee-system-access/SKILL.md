---
name: eceee-system-access
description: Compatibility entry for existing ECEEE system-access tasks; use the canonical eceee-api-operations skill for tenant-scoped CMS and workspace APIs.
---

# ECEEE system access compatibility

Read [ECEEE API operations](../eceee-api-operations/SKILL.md) and use its environment, credential and operation authorization rules. The legacy script entry point delegates to that same API client; it is not a second implementation or credential store. Do not reprovision or rotate an existing named key just to check access.

Use the repository's `eceee-workspace-operations` for collaboration and self-profile APIs, `eceee-help-authoring` for code-owned help, and `eceee-instructional-video-publisher` for the private Inbox instruction library. Public CMS Media is a separate destination. Production changes remain separately authorized.
