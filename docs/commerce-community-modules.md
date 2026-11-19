# Commerce and community modules

This batch belongs to ECEEE. Server code runs in the TypeScript publisher; it does not add Django product models or expose Django admin as a product surface.

## Surfaces

- CMS: **Settings → Service modules**, `/settings/modules`. Tenant administrators can enable commerce, customer support, FAQ and forum separately. The existing internal Inbox/support is separate.
- Public site: `/services`. Link this URL from the tenant's navigation. Products and published FAQ can be read anonymously. Buying, purchase history, support and forum require the site's existing allauth account. Email sign-in/registration, email codes and authenticator/recovery-code MFA use the existing backend. Passkey-only sign-in is not implemented on this standalone service page.
- CMS commerce: create/edit/archive products; create/archive/restore immutable prices; inspect purchases; refresh Stripe state; schedule/cancel subscription cancellation; change to another recurring price of the same product; refund the current payment; inspect receipts/invoices; grant/revoke manual and organization access; manage organizations and memberships. A subscription price change uses Stripe's pending update and immediate invoice; incomplete payment does not activate the change.
- **Configure customer portal** creates/updates this tenant/environment's Stripe portal configuration from the CMS. Customers can update payment methods and billing details, view invoices and cancel at period end. Initial account onboarding and business/tax verification remain Stripe account setup.
- Support is private between the authenticated customer and tenant administrators. Forum members can create/reply; administrators can hide/restore messages and hide/close/reopen discussions. No email notification, file attachment or websocket transport is assumed. Polling runs every five seconds while visible; browsing older messages pauses automatic replacement.

## Installation and runtime isolation

The schema is additive and disabled by default. No existing business rows are migrated. It requires the existing `core_tenant` and `auth_user` tables. Do not run schema installation as part of serving requests.

1. Provision a dedicated login such as `eceee_modules`, with a protected password, no ownership, no superuser/BYPASSRLS/CREATEDB/CREATEROLE, and no privileges on existing application tables. Keep schema-owner/migration credentials separate. Do not reuse the publisher's read-only or form-only role.
2. Securely inject `MODULE_MIGRATION_DATABASE_URL`, `MODULE_EXPECTED_DATABASE`, `MODULE_MIGRATION_ROLE` and optionally `MODULE_RUNTIME_ROLE` (default `eceee_modules`) into the migrator process. Run `cd publisher && npm run migrate:modules`. It validates the database and migration identity before DDL, locks schema installation, runs one transaction and grants SELECT/INSERT/UPDATE only on the module tables. It never prints credential values. Runtime must not receive the migration URL.
3. Configure `PUBLISHER_MODULE_DATABASE_URL` with the dedicated runtime role. The module store refuses superuser/BYPASSRLS connections. Every operation uses transaction-local `app.tenant_id` and all module tables have FORCE RLS and tenant-first foreign keys. A missing tenant context returns no rows.
4. The publisher reads only the dedicated optional `.env.modules` file (`deploy/.env.modules` in production compose, root `.env.modules` in development compose). Keep it ignored, mode 0600, and manage its secrets using the established secret workflow. Do not load the backend's general environment into the publisher. Production setup/activation is a separate operational step; this change does not create or deploy credentials.
5. `PUBLISHER_AUTH_ORIGIN` is the private backend origin, default `http://backend:8000`. Browser sessions are verified there on every protected request. The CMS also requires exact-workspace `tenant.admin`. The host and cookie are forwarded only to that configured origin. Configure backend `ALLOWED_HOSTS`, CSRF origins, browser email and allauth settings for each public service origin as part of normal site setup.
6. Production Caddy and the frontend proxy route `/api/modules/*` to the publisher. Public identity paths reach Django. Vite supports `VITE_PUBLISHER_URL` for host-side development. Test aliases use their existing content-host mapping; the module layer does not infer a tenant from a user-supplied public header.

For each tenant UUID, remove hyphens and uppercase it to form `TENANT`. Securely inject these names (the names below are templates, never client variables):

- `ECEEE_STRIPE_<TENANT>_MODE`: `test` or `live`, explicit and matching the key.
- `ECEEE_STRIPE_<TENANT>_SECRET_KEY`: this tenant's matching secret API key.
- `ECEEE_STRIPE_<TENANT>_WEBHOOK_SECRET`: the matching endpoint signing secret.

Keys are never accepted in CMS forms or returned by APIs. Different modes use different customers, prices, purchases, events and portal configurations. Switching modes does not reinterpret existing records.

Register a Stripe event destination pointing to `https://<public-host>/api/modules/webhook/<tenant-uuid>`, using the snapshot API version corresponding to the pinned Stripe SDK (`2026-10-28.endive`). Subscribe to:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
- `invoice.paid`, `invoice.payment_failed`.
- `customer.subscription.updated`, `customer.subscription.deleted`.
- `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.
- `refund.created`, `refund.updated`, `refund.failed`.

Webhook processing remains active after new sales are disabled. Purchase history and billing self-service also remain available. API responses are private/no-store. Signatures are checked over the original bounded body with Stripe's timestamp tolerance. Deduplication and access projection commit together; failures return a retryable error without committing the event. Do not acknowledge failed events as processed.

## Payment and access policy

Prices use integer **minor currency units** (not necessarily cents; zero-decimal currencies have their own unit). Stripe validates supported currency/amount combinations. One-time Checkout also enables invoice creation. Stripe issues all receipts/invoices and remains their technical source; the application retrieves safe hosted links after tenant/customer ownership checks. No card/payment-method data is stored locally.

One-time access lasts for the snapshotted number of days from payment, or indefinitely. Replays do not reset its start/end. Partial or full refunds revoke that purchase's grant; an active/lost dispute revokes it, and a won/closed warning dispute can restore it after reconciliation. Subscription access lasts only through a matching paid invoice line. An unpaid renewal never extends that period. Canceled, unpaid, incomplete-expired or paused subscriptions revoke their purchase grant; cancellation scheduled at period end preserves the paid period. A refund/dispute on the current paid subscription invoice revokes the current period. A later paid renewal can authorize the next period. Historical invoice refunds do not revoke a newer paid period. Independent manual/organization grants are not changed by a payment correction.

`GET /api/modules/access/<access-key>` reports the current user's effective access, considering grant dates, revocation, active organization membership and membership expiry. **This endpoint is an integration contract, not protection for an otherwise public URL.** A resource-serving server must call the same authorization before returning protected bytes; a frontend check alone is insufficient. This batch does not migrate existing public media into private storage or change existing page/download access policies. Bind report downloads and protected tenant content through their owning access/download module before selling that concrete resource. Organization and administrative grants do not require the recipient to be a CMS member.

Use a new request UUID for a new checkout/message and reuse it while retrying the same action. Checkout/customer/provider writes use stable Stripe idempotency keys. If a provider write succeeds but the local transaction loses its connection, retry promptly within Stripe's idempotency retention; do not reuse an unresolved key after its retention window without reconciling Stripe first. Event replay itself remains protected by persistent event IDs and unique grant sources.

## Verification and activation

Run focused module tests, publisher typecheck/lint/build and the frontend module workflow tests/build. `publisher/tests/modules-sql.sql` validates clean schema installation, repeat installation, transaction-local RLS, cross-tenant reads/writes/foreign keys, organization access, expiry, duplicate event IDs and rollback of failed processing against PostgreSQL. It runs only in a dedicated disposable database with synthetic fixtures; no existing project database is modified.

Before live activation, use a real configured Stripe test tenant to exercise successful/abandoned/delayed Checkout, webhook replays, subscription renewal/failure/cancellation/price-change, refunds/disputes and invoice/portal access. Confirm the seller, currency, tax and receipt configuration for the actual region. The automated provider tests use mocks and real SDK signature verification; they do not replace this account-level acceptance. No real Stripe key, external product, charge or customer is created by the test suite.

Rollback is application rollback or disabling modules, retaining all module tables and economic history. There is no automatic destructive down migration or cleanup. Periodic reconciliation/backfill beyond the explicit per-purchase refresh is not scheduled by this batch.
