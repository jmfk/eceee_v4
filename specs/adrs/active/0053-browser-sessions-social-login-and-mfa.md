---
id: ADR-0053
title: Browser sessions, explicit social identities and optional MFA
status: accepted
date: 2026-10-23
related_prds:
  - PRD-0038
supersedes: []
superseded_by: []
---

# ADR-0053: Browser sessions, explicit social identities and optional MFA

Use django-allauth[mfa,socialaccount] 65.20.1 (Django 4.2 compatible, verified 2026-10-23) for browser sessions, provider callbacks and MFA. React uses the browser API without changing allauth field casing; existing application APIs keep their adapters. Providers use ECEEE-only environment configuration; no provider tokens are persisted.

Social signup and email-based authentication/linking are disabled. Users explicitly connect identities after recent authentication. MFA supports TOTP, WebAuthn as second factor and once-visible recovery codes. TOTP/recovery material is encrypted through the MFA adapter with a dedicated Fernet keyring, supporting rotation by retaining old decryption keys. A missing key prevents enrollment and use rather than falling back to plaintext.

A small user security state holds a monotonically increasing version. Successful complete allauth logins stamp the session. Factor, identity and password changes advance the version, invalidating other sessions and signed browser tickets. Legacy JWT claims carry the version; unversioned credentials are version zero. Personal bearer authentication is rejected while MFA exists. DRF tokens created before the last security change are rejected. Machine keys cannot use account-management endpoints.

Browser sessions replace localStorage JWTs. Existing non-MFA integrations retain version-checked legacy token endpoints. MFA-enabled personal integrations must use an appropriate scoped machine identity. DEBUG auto-login has an explicit switch and must be disabled during authentication verification.

Migrations add security state and allauth tables without rewriting users, memberships or verification state. Production requires the repository's independent deployment gate. A rollback after MFA enrollment must not deploy an older authentication implementation that ignores MFA; roll forward or keep access unavailable until fixed.

## Sources

- https://docs.allauth.org/en/latest/mfa/configuration.html
- https://docs.allauth.org/en/latest/socialaccount/providers/apple.html
- https://docs.allauth.org/en/latest/headless/
- [PRD-0038](../../prds/0038-social-login-and-mfa.md)
