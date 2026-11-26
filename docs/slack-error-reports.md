# ECEEE error reports in Slack

Chachai `#eceee-fel` is the private destination for **new support bug reports**.
Server errors go to private `#eceee-serverfel`; never configure both webhook variables
with the same URL. The CMS Inbox remains the report record and enforces its normal
tenant/participant permissions when a Slack link is opened.

## Install the app

Create a Slack app in **Chachai** from `deploy/slack-app-manifest.json`. It requests
only `incoming-webhook`: it cannot read channel history, users, files or private
report content. Install it and create a channel-specific incoming webhook for
each destination. A user must already belong to a private channel to select it.
Confirmed destinations: [user reports](https://app.slack.com/client/T0CKZ6MPMM3/C0CLQ133XK7)
and [server errors](https://app.slack.com/client/T0CKZ6MPMM3/C0CLTDY7JKY).
The Slack connector cannot install this application; complete the authorization
in regular Chrome. Do not send webhook URLs in chat or paste them into a terminal
command. They are credentials.

Store the webhook URLs privately in the existing ignored environment file, using
the project's secret-handling workflow. Keep local/staging credentials separate
from production. Public setting names:

| Setting | Purpose |
| --- | --- |
| `SLACK_REPORTS_WEBHOOK_URL` | Incoming webhook for Chachai `#eceee-fel`. |
| `SLACK_SERVER_WEBHOOK_URL` | Different incoming webhook for the server-error destination. |
| `SLACK_REPORTS_ENABLED` | Default false; enables new report queueing and delivery. |
| `SLACK_SERVER_ERRORS_ENABLED` | Default false; enables Django/Celery and publisher error notices. |
| `SLACK_ENVIRONMENT` | `development`, `staging`, or `production`; production Compose fixes publisher to production. |
| `SLACK_SERVICE_NAME` | `backend`, `celery-worker`, or `celery-beat`, set per process. |
| `SUPPORT_APP_URL` | Existing HTTPS CMS origin, without a path/query/fragment, for report links. |

Backend, worker and Beat use the existing protected application environment. The
publisher receives only the server webhook and opt-in flag, never the report
webhook or broad deployment environment. No webhook belongs in a `VITE_` or
`NEXT_PUBLIC_` variable. Production Compose passes the publisher only its dedicated
notification credential.

Apply additive migration `tenant_support.0006_slackdelivery` using the ordinary
deployment workflow before enabling delivery. It creates an empty outbox table
with a due-job index and unique event identity, without modifying existing
reports, adding triggers, backfilling history or touching private objects. A
previous application release ignores the new table. Leave the table intact when
rolling application code back; do not reverse it and destroy queued delivery
history as an operational rollback.

This task does not authorize a production release or a production configuration
reload. Use the repository's reviewed tagged deployment and configuration gates.

## Activate both v4 streams

The owner selected **both** user reports and server errors for ECEEE v4. Prepare
the local protected deployment environment before the ordinary tagged release:

```sh
make prod-configure-slack
make prod-configure-slack APPLY=yes
make prod-deploy TAG=<reviewed-release-tag>
```

The first command prints a plan. The second copies the two already verified
webhook credentials from ignored `.env.slack.local` to existing protected
`deploy/.env`, sets both `SLACK_REPORTS_ENABLED=True` and
`SLACK_SERVER_ERRORS_ENABLED=True`, and sets the production environment/CMS link
origin. It preserves unrelated settings, rejects different pre-existing webhook
credentials rather than rotating them, and is idempotent. It performs no network
requests. The final command is the separately authorized reviewed release flow,
including the existing backup, migration and restart gates.

When using a separate checkout, pass the original protected source explicitly:
`make prod-configure-slack APPLY=yes SLACK_WEBHOOKS_ENV=/absolute/path/.env.slack.local`.
Both source and target must be mode 0600 and Git-ignored in their owning
checkout. No credential values enter arguments, logs, the PR or its description.
The new table must be migrated before these settings reach a running backend.
Do not use the restart-only target for this initial schema-changing release.

## Behavior and operational limits

- Only a new bug addressed to **support** creates a report notice, transactionally
  with the report. Questions, private direct messages and replies do not. Request
  retries do not create duplicate outbox entries. Disabled capture does not create
  a historical backlog.
- Notices contain a generic heading, environment/release, and a CMS link. Report
  titles, bodies, reported locations, attachments, user emails and names are excluded.
- Django/Celery ERROR/CRITICAL logs queue only allowlisted exception classes and
  repository-relative stack metadata. No log formatting, exception values,
  arguments, headers or request bodies are used. Server events group by service,
  tenant, release and code location in ten-minute buckets. A bounded per-process
  filter suppresses repeats for ten minutes before broker submission, so repeated
  errors do not fill the default task queue. It remembers at most 1,000 groups;
  new groups beyond that bound are suppressed until entries expire. Broker failure
  uses a 30-second per-group cooldown. Broker enqueue failure
  is swallowed to preserve the original request; independent availability
  monitoring is still needed for host, database and broker outages.
- Beat schedules `tenant_support.tasks.deliver_slack_pending` once a minute.
  Row-locked claims prevent concurrent workers from sending the same queued job.
  Sends time out after five seconds. Explicit 429 rejection retries with bounded
  Retry-After, at most five submissions. Invalid/revoked webhooks fail; timeouts,
  ambiguous provider responses and interrupted claimed jobs become **uncertain**.
  Never blindly requeue uncertain jobs: inspect the destination first.
- The publisher captures unhandled Next.js request errors through
  `instrumentation.ts`, plus handled form/editorial/news-preview/health/theme-error
  failures. Handled errors send after the response,
  while unhandled-error instrumentation starts bounded delivery in the background
  on the long-lived Node server to preserve error-response latency. It sends only service, source,
  allowlisted error class, environment and release. Its ten-minute suppression is
  per process and resets on restart. It has no durable outbox, and does not retry a
  timed-out send. Repeated failures after explicit rate limiting may send after
  Retry-After. No request paths, hosts, query strings, messages or raw stacks leave
  the publisher.
- Browser JavaScript failures remain in the existing report diagnostics; this
  integration automatically captures server errors, not every browser console entry.
- Failed/uncertain support deliveries remain in `tenant_support.SlackDelivery`
  with bounded states/error codes and attempts. They are not email deliveries and
  do not appear in the email-delivery UI. There is no automatic destructive cleanup.

## Verification and activation

Focused mocked tests: `tenant_support.test_slack` under
`tenant_support.test_settings`, and publisher `tests/slack-errors.test.ts` plus the
affected route tests. They do not send messages to Slack. Run a controlled report
and a synthetic server error only after installing the real app, privately saving
the separate webhook credentials, and explicitly enabling the intended environment.
Confirm each destination, duplicate suppression and authenticated report links.

### Local handoff, 2026-11-25

Both private channels exist. Slack app **ECEEE Felrapporter** (A0CLVESNKCJ) is
installed in Chachai with `incoming-webhook`. Both channel-specific integrations
exist. After explicit owner approval, their URLs were copied through Slack's
channel-specific **Copy** buttons and privately saved in ignored, mode-0600
`.env.slack.local`. Validation confirmed both values are present, use Slack's
webhook origin, and are distinct, without displaying values. The clipboard was
cleared after transfer. That file is a protected handoff
source and is not automatically loaded by runtime. Distribute each value to the
intended environment using the established protected environment workflow, then
enable the respective flag. No production configuration or release has run.

If the operator explicitly authorizes clipboard transfer, the agent may use the
channel row's **Copy** button and then run
`python3 deploy/scripts/import-slack-webhook.py reports|server --from-clipboard`.
This purpose-built macOS helper consumes the copied URL internally, validates its
Slack origin, atomically updates only the selected key in the fixed ignored file,
requires mode 0600, rejects duplicate destinations, and returns only bounded state
codes. It never prints clipboard or file contents. This does not authorize reading
unrelated clipboard contents, revealing credential controls, or inspecting the
secret file through a GUI. Three fixture-only helper tests pass. Live imports were
performed only after the owner's explicit approval of both channel authorizations
and direct clipboard-to-file storage.

Validation: `python manage.py test tenant_support.test_slack tenant_support.tests
--settings=tenant_support.test_settings --noinput` passed 45 cases, with three
PostgreSQL-only cases skipped. `makemigrations tenant_support` with `--check
--dry-run` reported no changes. The new 14 Slack tests cover the outbox and
adapters; concurrent PostgreSQL claims and live provider acceptance remain rollout
checks. The additional messaging suite hit four isolated-profile/dependency errors
(`content` not installed, upload-validation import failures, missing Pillow),
outside the Slack path; no unrelated test settings were changed.

Publisher affected tests passed 25 cases. TypeScript, changed-file ESLint,
production build and browser-bundle secret-boundary check passed. Automated tests
sent no external messages. Separate controlled live acceptance sent one neutral
connection test to each configured webhook on 2026-11-25. Slack accepted both,
and channel history confirmed the user-report test in `#eceee-fel` and the
server-error test in `#eceee-serverfel`. This verifies transport and routing,
not automatic capture in the deployed application. Application deployment,
protected runtime configuration, opt-in flags and end-to-end capture remain.

The 2026-11-26 PR gate additionally passed 51 tests on a disposable PostgreSQL 17
instance, including concurrent delivery/group claims and upgrade from an existing
0005 report through 0006 with idempotent reapplication. The publisher package
passed 162 tests, lint, TypeScript and production build; seven protected helper
tests passed. Independent review findings about broker storms, duplicate Django
handlers and error-response latency were fixed and rechecked. The existing
Next.js 16.4.2 dependency warning is addressed by security PR #370 and should be
merged before deployment. Runtime end-to-end acceptance remains a release check.

References: [PRD-0066](../specs/prds/0066-slack-error-reports.md),
[ADR-0082](../specs/adrs/active/0082-private-slack-error-notifications.md),
[Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/),
[Next.js request instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
