---
id: ADR-0055
title: Explicit email verification before optional MFA
status: accepted
date: 2026-10-25
related_prds: [PRD-0038]
supersedes: []
superseded_by: []
---

# ADR-0055: Explicit email verification before optional MFA

## Context

The owner clarified that email verification must be optional and explicitly
requested, with an email address present before sending. Ordinary CMS sign-in
must not send verification mail or require a verified address. PRD-0038 still
requires verified email before enabling optional two-factor authentication.

## Decision

Use allauth's optional email-verification policy. Existing accounts can sign in
with their password or connected provider without automatic verification mail,
including accounts without an email address. Existing MFA challenges still apply.

Profile provides an explicit request-and-confirm step before MFA enrollment.
Require a valid email address before that request, allow an account with no
address to add one through allauth, and retain recent authentication, CSRF,
rate limits and expiring signed confirmation links. Allauth 65.20.1 requires
mandatory verification for code mode, so optional verification uses link mode. Loading Profile never sends mail.
Do not introduce email as a second factor or mark existing addresses verified.

Password resets and other intentionally requested transactional mail continue
to use the repaired Postmark backend (ADR-0054). No database migration or
production configuration mutation is part of this change.

## Links

- [PRD-0038](../../prds/0038-social-login-and-mfa.md)
- [ADR-0053](0053-browser-sessions-social-login-and-mfa.md)
- [ADR-0054](0054-postmark-authentication-email-backend.md)
