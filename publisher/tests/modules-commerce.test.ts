import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { Tx } from '../src/modules/store';

const api = vi.hoisted(() => ({ session: vi.fn(), intent: vi.fn(), subscription: vi.fn(), customer: vi.fn(), checkout: vi.fn(), invoicePayments: vi.fn(), disputes: vi.fn(), updateSubscription: vi.fn() }));
vi.mock('../src/modules/stripe', async importOriginal => {
  const original = await importOriginal<typeof import('../src/modules/stripe')>();
  const sdk = new Stripe('sk_test_fixture');
  return { ...original, stripeFor: () => ({ mode: 'test', webhookSecret: 'whsec_fixture', stripe: {
    checkout: { sessions: { retrieve: api.session, create: api.checkout } }, paymentIntents: { retrieve: api.intent },
    subscriptions: { retrieve: api.subscription, update: api.updateSubscription }, invoicePayments: { list: api.invoicePayments }, disputes: { list: api.disputes }, customers: { create: api.customer }, webhooks: sdk.webhooks,
  } }) };
});
import { checkout, hasAccess, reconcile, webhook, subscriptionAction } from '../src/modules/commerce';

const tenant = '10000000-0000-0000-0000-000000000001';
const id = '20000000-0000-0000-0000-000000000001';
const priceId = '30000000-0000-0000-0000-000000000001';
const metadata = { tenantId: tenant, purchaseId: id };
let purchase: Record<string, unknown>;
let grants: Record<string, unknown>[];
let events: Set<string>;
let statements: { sql: string; values: unknown[] }[];
function tx() {
  return { query: vi.fn(async (sql: string, values: unknown[] = []) => {
    statements.push({ sql, values });
    if (sql.startsWith('SELECT * FROM modules.purchases')) return { rows: [purchase] };
    if (sql.startsWith('SELECT stripe_id FROM modules.customers')) return { rows: [{ stripe_id: 'cus_fixture' }] };
    if (sql.startsWith('SELECT p.* FROM modules.prices') || sql.startsWith('SELECT * FROM modules.prices')) return { rows: [{ id: priceId, stripe_id: 'price_fixture', amount: 1000, currency: 'eur' }] };
    if (sql.startsWith('UPDATE modules.purchases')) {
      purchase = { ...purchase, status: values[2], subscription_id: values[3], payment_intent_id: values[4], invoice_id: values[5], paid_until: values[7] };
    }
    if (sql.startsWith('INSERT INTO modules.grants')) {
      grants = [{ user: values[2], key: values[3], source: values[4], end: values[5], start: values[6], revoked: false }];
    }
    if (sql.startsWith('UPDATE modules.grants SET revoked=true')) grants = grants.map(grant => ({ ...grant, revoked: true }));
    if (sql.startsWith('INSERT INTO modules.webhook_events')) {
      if (events.has(String(values[2]))) return { rows: [] };
      events.add(String(values[2])); return { rows: [{ id: values[2] }] };
    }
    return { rows: [] };
  }) } as unknown as Tx;
}
function event(type = 'checkout.session.completed', eventId = 'evt_fixture', live = false) {
  const raw = JSON.stringify({ id: eventId, type, livemode: live, data: { object: { object: 'checkout.session', metadata, id: 'cs_fixture' } } });
  return { raw, signature: Stripe.webhooks.generateTestHeaderString({ payload: raw, secret: 'whsec_fixture' }) };
}
beforeEach(() => {
  vi.clearAllMocks(); events = new Set(); grants = []; statements = [];
  purchase = { id, user_id: 1, price_id: priceId, mode: 'test', status: 'pending', session_id: 'cs_fixture',
    access_key: 'report:fixture', access_days: 365, paid_until: null, created_at: new Date('2026-01-01') };
  api.invoicePayments.mockResolvedValue({ data: [], has_more: false });
  api.disputes.mockResolvedValue({ data: [{ status: 'needs_response' }] });
  api.session.mockResolvedValue({ id: 'cs_fixture', livemode: false, metadata, customer: 'cus_fixture', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_fixture', invoice: 'in_fixture', currency: 'eur', amount_subtotal: 1000,
    line_items: { data: [{ price: { id: 'price_fixture' }, quantity: 1 }] } });
  api.intent.mockResolvedValue({ status: 'succeeded', metadata, customer: 'cus_fixture', latest_charge: { created: 1767225600, amount_refunded: 0, disputed: false } });
});
describe('verified commerce projection', () => {
  it('processes a signed paid event once and never duplicates or prolongs its grant', async () => {
    const sent = event(); const db = tx();
    await webhook(db, tenant, sent.raw, sent.signature);
    const first = grants[0];
    await webhook(db, tenant, sent.raw, sent.signature);
    await reconcile(db, tenant, id);
    expect(api.session).toHaveBeenCalledTimes(2);
    expect(grants).toHaveLength(1); expect(grants[0]).toEqual(first);
    expect(purchase.status).toBe('paid'); expect(first.start).toEqual(new Date('2026-01-01'));
  });
  it('rejects a forged signature before accessing the order', async () => {
    const sent = event(); const db = tx();
    await expect(webhook(db, tenant, sent.raw, 'forged')).rejects.toMatchObject({ status: 400 });
    expect(statements).toHaveLength(0); expect(grants).toHaveLength(0);
  });
  it('rejects a replay whose signature timestamp is outside tolerance', async () => {
    const sent = event(); const signature = Stripe.webhooks.generateTestHeaderString({ payload: sent.raw, secret: 'whsec_fixture', timestamp: 1 });
    await expect(webhook(tx(), tenant, sent.raw, signature)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects live events in a test environment', async () => {
    const sent = event('checkout.session.completed', 'evt_live', true);
    await expect(webhook(tx(), tenant, sent.raw, sent.signature)).rejects.toMatchObject({ status: 400 });
    expect(statements).toHaveLength(0);
  });
  it.each([
    { customer: 'cus_other' }, { metadata: { ...metadata, tenantId: 'another' } }, { currency: 'sek' },
    { amount_subtotal: 1 }, { line_items: { data: [{ price: { id: 'price_other' }, quantity: 1 }] } },
  ])('fails closed when server verification mismatches %j', async override => {
    api.session.mockResolvedValue({ ...await api.session(), ...override });
    await expect(reconcile(tx(), tenant, id)).rejects.toMatchObject({ status: 409 }); expect(grants).toHaveLength(0);
  });
  it('does not grant access for delayed unconfirmed payments', async () => {
    api.session.mockResolvedValue({ ...await api.session(), payment_status: 'unpaid' });
    api.intent.mockResolvedValue({ ...await api.intent(), status: 'processing' });
    await reconcile(tx(), tenant, id); expect(grants).toHaveLength(0); expect(purchase.status).toBe('pending');
  });
  it('revokes refunded purchases even if an older successful event arrives later', async () => {
    const db = tx(); await reconcile(db, tenant, id);
    api.intent.mockResolvedValue({ ...await api.intent(), latest_charge: { amount_refunded: 1000 } });
    const refund = event('charge.refunded', 'evt_refund'); await webhook(db, tenant, refund.raw, refund.signature);
    const late = event('checkout.session.completed', 'evt_late'); await webhook(db, tenant, late.raw, late.signature);
    expect(purchase.status).toBe('refunded'); expect(grants[0].revoked).toBe(true);
  });
  it('revokes disputed payments', async () => {
    const db = tx(); await reconcile(db, tenant, id);
    api.intent.mockResolvedValue({ ...await api.intent(), latest_charge: { disputed: true } });
    await reconcile(db, tenant, id); expect(grants[0].revoked).toBe(true);
  });
  it('extends subscriptions only to the period of a paid matching invoice line', async () => {
    api.session.mockResolvedValue({ ...await api.session(), subscription: 'sub_fixture', payment_intent: null });
    const future = Math.floor(Date.now() / 1000) + 86400;
    api.subscription.mockResolvedValue({ items: { data: [{ price: { id: 'price_fixture' } }] }, status: 'active', metadata, customer: 'cus_fixture', cancel_at_period_end: true,
      latest_invoice: { id: 'in_fixture', status: 'paid', lines: { data: [{ pricing: { price_details: { price: 'price_fixture' } }, period: { end: future } }] } } });
    await reconcile(tx(), tenant, id); expect(grants[0].end).toEqual(new Date(future * 1000));
    const sameGrant = grants[0];
    api.subscription.mockResolvedValue({ ...await api.subscription(), status: 'past_due', latest_invoice: { status: 'open', id: 'in_unpaid' } });
    await reconcile(tx(), tenant, id); expect(grants[0]).toEqual(sameGrant);
    api.subscription.mockResolvedValue({ ...await api.subscription(), status: 'canceled' });
    await reconcile(tx(), tenant, id); expect(grants[0].revoked).toBe(true);
  });
  it('revokes a refunded subscription invoice and restores a won one-time dispute', async () => {
    api.session.mockResolvedValue({ ...await api.session(), subscription: 'sub_fixture', payment_intent: null });
    const future = Math.floor(Date.now() / 1000) + 86400;
    api.subscription.mockResolvedValue({ items: { data: [{ price: { id: 'price_fixture' } }] }, status: 'active', metadata, customer: 'cus_fixture', latest_invoice: { id: 'in_fixture', status: 'paid', lines: { data: [{ pricing: { price_details: { price: 'price_fixture' } }, period: { end: future } }] } } });
    const db = tx(); await reconcile(db, tenant, id);
    api.invoicePayments.mockResolvedValue({ data: [{ payment: { payment_intent: 'pi_renewal' } }] });
    api.intent.mockResolvedValue({ ...await api.intent(), latest_charge: { amount_refunded: 1000 } });
    await reconcile(db, tenant, id); expect(grants[0].revoked).toBe(true); expect(purchase.status).toBe('refunded');
    api.session.mockResolvedValue({ ...await api.session(), subscription: null, payment_intent: 'pi_fixture' });
    api.intent.mockResolvedValue({ ...await api.intent(), latest_charge: { id: 'ch_fixture', created: 1767225600, disputed: true, amount_refunded: 0 } });
    api.disputes.mockResolvedValue({ data: [{ status: 'won' }] });
    await reconcile(db, tenant, id); expect(grants[0].revoked).toBe(false); expect(purchase.status).toBe('paid');
  });
  it('does not grant an active subscription without a paid invoice', async () => {
    api.session.mockResolvedValue({ ...await api.session(), subscription: 'sub_fixture', payment_intent: null });
    api.subscription.mockResolvedValue({ items: { data: [{ price: { id: 'price_fixture' } }] }, status: 'active', metadata, customer: 'cus_fixture', latest_invoice: { id: 'in_fixture', status: 'open' } });
    await reconcile(tx(), tenant, id); expect(grants).toHaveLength(0);
  });
  it('returns the existing Checkout Session for a retry instead of creating another', async () => {
    api.session.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/fixture' });
    await checkout(tx(), { tenantId: tenant, actor: { id: 1, name: 'Member' }, admin: false }, { priceId, requestKey: id }, 'https://example.test');
    expect(api.checkout).not.toHaveBeenCalled(); expect(api.customer).not.toHaveBeenCalled();
  });
  it('creates Checkout using only the tenant catalog price, ignoring a client-supplied amount', async () => {
    const db = { query: vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT count')) return { rows: [{ count: '0' }] };
      if (sql.includes('SELECT p.*,product.access_key')) return { rows: [{ id: priceId, stripe_id: 'price_fixture', interval: 'once', access_key: 'report:fixture', access_days: 365 }] };
      if (sql.startsWith('SELECT stripe_id FROM modules.customers')) return { rows: [{ stripe_id: 'cus_fixture' }] };
      if (sql.startsWith('INSERT INTO modules.purchases')) return { rows: [{ ...purchase, session_id: null }] };
      return { rows: [] };
    }) } as unknown as Tx;
    api.checkout.mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.com/c/pay/new' });
    await checkout(db, { tenantId: tenant, actor: { id: 1, name: 'Member' }, admin: false }, { priceId, requestKey: id, amount: 1 }, 'https://example.test');
    expect(api.checkout).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: 'price_fixture', quantity: 1 }], customer: 'cus_fixture', mode: 'payment', metadata, invoice_creation: { enabled: true } }), expect.objectContaining({ idempotencyKey: expect.stringContaining(id) }));
    expect(api.checkout.mock.calls[0][0]).not.toHaveProperty('amount');
  });
  it('requires tenant administration before accepting a subscription price change', async () => {
    purchase.subscription_id = 'sub_fixture';
    await expect(subscriptionAction(tx(), { tenantId: tenant, actor: { id: 1, name: 'Member' }, admin: false }, id, { priceId, requestKey: id })).rejects.toMatchObject({ status: 403 });
    expect(api.updateSubscription).not.toHaveBeenCalled();
  });
  it('does not send an unknown or other-product subscription price to Stripe', async () => {
    purchase.subscription_id = 'sub_fixture';
    await expect(subscriptionAction(tx(), { tenantId: tenant, actor: { id: 1, name: 'Admin' }, admin: true }, id, { priceId, requestKey: id })).rejects.toMatchObject({ status: 400 });
    expect(api.updateSubscription).not.toHaveBeenCalled();
  });
  it('scopes access to the caller, expiry, revocation and active organization membership', async () => {
    expect(await hasAccess(tx(), { tenantId: tenant, actor: { id: 2, name: 'Other' }, admin: false }, 'report:fixture')).toBe(false);
    const query = statements.at(-1)!;
    expect(query.values).toEqual([tenant, 2, 'report:fixture']);
    expect(query.sql).toContain('NOT revoked'); expect(query.sql).toContain('ends_at>now()'); expect(query.sql).toContain('valid_until>now()');
  });
});
