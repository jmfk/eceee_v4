---
id: ADR-0003
title: Tenant membership authorization
status: accepted
date: 2026-09-22
related_prds:
  - PRD-0002
supersedes: []
superseded_by: []
---

# ADR-0003: Tenant Membership Authorization

## Context

Several API querysets use the content creator as a proxy for tenant access. This prevents legitimate collaborators from editing shared tenant content and can expose inconsistent behavior depending on who created a page.

## Decision

Tenant access is granted to staff, the tenant creator, or users in an explicit tenant-members relation. Page and version querysets first scope to the selected tenant and then check tenant access. Content ownership does not grant cross-tenant access.

Page hierarchy mutations and theme CRUD use the same selected-tenant boundary. Caller-supplied page, parent, and theme IDs never widen the active tenant scope.

Theme fallback resolution, default-theme creation, and root-page sibling ordering are tenant-scoped as well. A tenant-specific default may never clear, render, or return another tenant's theme, and root-page maintenance may never reorder another tenant's pages.

Writable page-version relationships are also tenant-scoped. An explicit theme must belong to the owning page's tenant; caller-supplied related-object IDs never widen that boundary.

Clients send the selected tenant identifier on every API request. If the header is absent, middleware may infer a tenant only when the authenticated user has exactly one accessible tenant before applying the configured development fallback.

## Rationale

Authorization belongs to the tenant boundary, while `created_by` remains audit metadata. Explicit membership supports collaboration without weakening isolation.

## Consequences

- Existing tenant creators are backfilled as members.
- Additional editors must be assigned membership explicitly.
- Requests with an invalid or unauthorized tenant remain inaccessible even if the user created similarly named content elsewhere.

## Alternatives Considered

- Continue authorizing by content creator: rejected because it is not an organization membership model.
- Permit all authenticated users in the selected tenant header: rejected because the header is caller-controlled.

## Links

- Related PRD: [PRD-0002](../../prds/0002-page-workflow-invariant-hardening.md)
