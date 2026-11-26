---
id: PRD-0066
title: ECEEE error reports in Slack
status: in-progress
locked: true
created: 2026-11-25
related_adrs:
  - ADR-0082
---

# ECEEE error reports in Slack

## Requirements

- Notify Chachai `#eceee-fel` of newly submitted ECEEE support bug reports. Keep automatic server errors in a separate destination.
- Capture Django/Celery server errors and Next.js publisher request failures without changing the original request outcome.
- Send bounded technical metadata and authenticated CMS links. Never send report titles/bodies, attachments, reported URLs, raw exception messages, request data or credentials.
- Preserve private direct conversations: only bug reports addressed to support produce notifications.
- Deduplicate submission retries and repeated server errors. Keep support notifications durable and expose uncertain external delivery outcomes without automatic duplicate sends.
- Use a purpose-specific Slack app, with server-side credentials and independent opt-in settings. Do not deploy or mutate production as part of local implementation.

## Acceptance

Focused tests verify report filtering, transaction rollback/idempotency, destination separation, payload privacy, bounded delivery and failure handling. Document setup, operational limits and remaining activation steps.

## Implementation notes

- 2026-11-25: Owner selected ECEEE, user reports and automatic system errors, Chachai `#eceee-fel`, then requested a separate list for server errors. Exact Slack list/channel presentation is being clarified.
- Existing unrelated editorial changes in the checkout must be preserved.
- 2026-11-26: Owner requested a PR to enable automatic reporting and confirmed that v4 should include **both user reports and server errors**. The batch is isolated from current `origin/main`; production activation remains the separately authorized tagged release. The PR includes `prod-configure-slack` to stage both flags and existing private credentials in the normal local deployment environment.
- 2026-11-25: Created private channel `#eceee-fel` (C0CLQ133XK7) and, following the owner's request for a separate list, Slack List **ECEEE serverfel** (F0CLV735LAE). Server delivery uses the Lists API with write-only bot scope; report delivery uses a channel-specific webhook.
- 2026-11-25: Owner clarified **a separate channel**, `#eceee-serverfel` (C0CLTDY7JKY), rather than Slack Lists. Both final destinations use independent channel-specific incoming webhooks. The empty list above is unused and no Lists permissions are requested.

## Linked ADRs

- [ADR-0082](../adrs/active/0082-private-slack-error-notifications.md)

## Completion evidence

- 2026-11-25: Implemented support outbox, safe Django/Celery logging adapters, publisher instrumentation and handled-error capture, independent webhook destinations, protected opt-in settings and setup documentation.
- Backend: 45 focused Slack/support tests ran successfully (three PostgreSQL-only cases skipped), with real SQLite migrations; migration drift check passed. Earlier Docker verification passed the initial 11 Slack tests before OrbStack became unavailable. Final checks used an isolated uv Python environment without application credentials.
- Publisher: 25 affected tests, TypeScript, changed-file ESLint and production build passed. Build verification rejects Slack configuration in browser chunks. Later bounded-response handling was rechecked with focused tests and TypeScript/lint.
- Broader messaging verification encountered four fixture/environment errors outside the Slack path: the isolated profile excludes the `content` application, upload-validation module imports failed, and Pillow was absent. These were not modified. PostgreSQL concurrent claims and live Slack acceptance remain unverified.
- Specs validation passed. No PR, push, merge, production connection, database mutation or deployment was performed. Application changes remain local with the existing unrelated editorial work preserved.
- Slack app manifest is prepared for Chachai in regular Chrome at **Review your app → Create and Install**, requesting only `incoming-webhook`. Installation, private webhook entry and environment activation are pending the operator handoff. The ignored mode-0600 `.env.slack.local` contains empty credential slots; it is not loaded by runtime automatically.
- 2026-11-25 follow-up: Observed Slack's success confirmation that **ECEEE Felrapporter** (A0CLVESNKCJ) is created and installed in Chachai. Protected local webhook fields are still empty. Prepared both channel-specific OAuth tabs with the correct channels selected and enabled **Allow** buttons; no final OAuth submission or secret-value inspection was performed by the agent. Operator approval, private URL entry and environment activation remain.
- 2026-11-25 connection acceptance: Owner explicitly approved both channel authorizations and direct clipboard-to-file transfer. Existing channel integrations were found, so no additional hooks were created. The tested redacting import helper stored distinct Slack URLs in protected, Git-ignored `.env.slack.local` without displaying values, then cleared the clipboard. One neutral live transport test per destination was accepted by Slack and confirmed in the correct channel. Runtime configuration, opt-in flags, application deployment and automatic-capture acceptance are still pending; no production mutation occurred.
- 2026-11-26 PR preparation: Isolated the complete batch from `origin/main`, added idempotent protected deployment configuration for both streams and CI coverage for its helpers. Independent P0–P3 review found three P2 issues (repeated broker submissions, shared-list duplicate log handlers, awaited Slack transport in the publisher error path); all were fixed with regression coverage and a clean targeted independent recheck. No verified P0/P1 or unresolved batch findings remain.
- Final local evidence: 51 Slack/support tests passed on a disposable PostgreSQL 17 instance, including actual 0005→0006 upgrade with an existing report, idempotent reapplication, concurrent grouping and competing workers. The disposable instance was removed afterward. Publisher package tests passed 162 cases (three pre-existing optional SQL cases skipped); new instrumentation cases passed, and ESLint, TypeScript and the production/client-boundary build passed with CI-installed dependencies. Seven protected configuration/helper cases passed. Changed Python uses CI's Black 25.11.0 plus isort/flake8; specs and workflow validation passed.
- Existing dependency limitation: installed Next.js 16.4.2 reports moderate security advisories. The build's initial upgrade reminder stopped once; its documented retry completed with the warning. Open PR #370 already contains the 16.4.6 dependency fix with passing Full CI. Merge that security update before deploying this feature; this batch does not duplicate the dependency change.
