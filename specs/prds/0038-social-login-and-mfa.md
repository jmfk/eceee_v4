---
id: PRD-0038
title: Apple and Google sign-in with optional MFA
status: in-progress
locked: true
created: 2026-10-23
related_adrs:
  - ADR-0053
---

# PRD-0038: Apple and Google sign-in with optional MFA

## Requirements

Existing CMS users can explicitly connect Apple and Google in Profile after recent authentication. Email matches never link accounts and signup is closed. Existing user IDs, passwords, roles and memberships remain authoritative.

Optional MFA supports TOTP, WebAuthn as a second factor, and ten single-use recovery codes shown once. MFA applies after password and social login. Verified email and a working factor are required before activation. Password reset never removes MFA. Passwordless login, trusted browsers, SMS/email factors and operator recovery are excluded.

React uses allauth browser sessions, CSRF and shared login/reauthentication components. Security changes invalidate older sessions, tokens and browser tickets. Personal legacy tokens cannot bypass MFA. Machine keys retain their distinct authorization boundary. Development auto-login can be disabled for HTTP and WebSockets.

## Acceptance Criteria

- Provider callbacks, linking conflicts and partial authentication cannot grant CMS or cross-tenant access.
- TOTP and WebAuthn enrollment and challenges are validated server-side; secrets are encrypted and never logged.
- Recovery codes are consumed once; replacement invalidates old codes.
- Existing installations upgrade without changing account ownership or manufacturing email verification.
- Focused backend/frontend tests, migrations and build cover login, recovery, revocation and existing workflows.
- ECEEE-owned provider credentials, HTTPS callback configuration and manual acceptance requirements are documented; production deployment is separate.

## Implementation Notes

Implementation started 2026-10-23. Preserve unrelated workspace messaging, role and diagnostics changes already in the working tree.

## Linked ADRs

- [ADR-0053](../adrs/active/0053-browser-sessions-social-login-and-mfa.md)

## Completion Evidence

- Local implementation: browser sessions, Apple/Google explicit connections, MFA, encrypted enrollment/factor data, revocation and Profile UI implemented.
- `python manage.py test cms_auth --settings=cms_auth.test_settings --noinput`: 33 passed, including real software WebAuthn verification, mocked Google/Apple callbacks, recovery, tenant membership preservation, real ASGI sessions and Kanban ticket WebSockets.
- `python manage.py makemigrations cms_auth --check --dry-run --settings=cms_auth.test_settings`: no changes. Django checks for the isolated auth, support and diagnostics settings passed.
- Focused Vitest run covering authentication components/adapter, API client, AuthContext, login return destination and Profile: 17 passed across 6 files.
- `npm run build`: passed; existing large-chunk warnings remain. Focused ESLint: no errors, existing AuthContext Fast Refresh export warning remains. Black and `git diff --check`: passed.
- Browser QA with synthetic responses: login and Profile inspected at 1280px and 390px; no page errors or horizontal overflow. Screenshots remain outside the repository.
- Specs governance validator passed. No commit, push, PR or deployment was performed. Existing unrelated local changes were preserved.
- Pending: ECEEE-specific provider credentials, MFA encryption key provisioning and actual registered HTTPS provider acceptance. PostgreSQL concurrency and target-specific allauth upgrade history have not been verified. Existing general Kanban test module could not be imported under its minimal support harness because content models are absent; the new isolated auth suite exercises the real Kanban consumer and ticket revocation instead.


## PR preparation

- Authentication changes isolated on `codex/social-login-mfa` from current `main`; unrelated diagnostics work and its dependency are excluded.
- Re-ran the isolated auth suite on this branch: 33 tests passed. Preserved the two newer limited-role login regressions from `main`; focused frontend verification now passes 19 tests across six files.
- Frontend production build passed. Applied the repository's exact Black 25.11.0, isort and flake8 gate to changed Python files. Test classes now explicitly isolate their URLs/mail/cache/synthetic keys when discovered by the normal project runner.
- Broader suites and live provider acceptance remain outside this preparation. No merge or production deployment is authorized by the request to create a PR.

## Review verification (2026-10-24)

- Fixed the operator-generated password-reset link contract: allauth-compatible user ID encoding and output serialization. Real API regressions redeem the returned link, reject reuse, preserve existing MFA and advance credential revocation state.
- Authentication tests now assert that the existing user-ID set is unchanged instead of assuming a migration-free empty database.
- `python manage.py test core.tests.AdminPasswordResetLinkTest cms_auth --keepdb --noinput` passed 35 tests using the full project migrations on an isolated PostgreSQL 17 test database, with development auto-login disabled. The standalone in-memory auth suite still passes 33 tests; `makemigrations cms_auth --check --dry-run` reports no changes. Changed Python files pass Black/isort/flake8.
- Review and CI evidence is tracked in [PR #277](https://github.com/jmfk/eceee_v4/pull/277). Live ECEEE provider acceptance and environment-specific secret provisioning remain pending; this review performs no production/provider configuration changes.
