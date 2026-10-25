---
id: ADR-0054
title: Compatible Postmark delivery for authentication email
status: accepted
date: 2026-10-25
related_prds: [PRD-0038]
supersedes: []
superseded_by: []
---

# ADR-0054: Compatible Postmark delivery for authentication email

## Context

Existing-account verification and password reset fail when production imports
`postmark.django_backend.EmailBackend`. The installed `django-postmark` 0.1.6
does not provide that module, and its available backend contains Python 2 syntax.
Authentication tests using Django's in-memory backend did not exercise this path.

## Decision

Replace `django-postmark` with `django-anymail[postmark]==14.0`, the last Anymail
major compatible with the repository's Django 4.2 constraint. Use
`anymail.backends.postmark.EmailBackend` in production and preserve the console
backend in development plus explicit `EMAIL_BACKEND` overrides.

Map the existing `POSTMARK_API_KEY` to Anymail's `POSTMARK_SERVER_TOKEN`, preserve
the configured open-tracking preference, and use Postmark's non-delivery test
token when `POSTMARK_TEST_MODE` is enabled. Keep API payload debugging disabled.
Postmark remains the only production email provider; no new credentials,
webhook routes, mail queue, account changes or email-verification bypass are added.

## Verification and consequences

Exercise the real production settings, templates and backend with a mocked HTTPS
transport, including verification and reset requests. The custom confirmation
template must show the code when allauth supplies one and retain link-mode support.
Tests must not contact Postmark or
print credentials, verification codes or reset payloads. Live delivery needs a
separately authorized acceptance check after reviewed deployment.

The Django 4.2 dependency constraint prevents using Anymail 15+, which requires
Django 5.0+. Revisit the pin during the framework upgrade.

## Links

- [PRD-0038](../../prds/0038-social-login-and-mfa.md)
- [Anymail Postmark configuration](https://anymail.dev/en/v14.0/esps/postmark/)
- [Anymail changelog](https://github.com/anymail/django-anymail/blob/main/CHANGELOG.rst)
