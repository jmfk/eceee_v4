import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { one, rows, type Tx } from './store';
import { stripeFor, providerId, safeStripeUrl } from './stripe';
import { accessKey, boolean, date, fail, integer, text, uuid } from './validation';
import type { Scope } from './auth';

export type Product = { id: string; name: string; description: string; accessKey: string; accessDays: number | null;
  active: boolean; stripeId: string; mode: string; revision: number };
export type Price = { id: string; productId: string; amount: number; currency: string; interval: 'once' | 'month' | 'year'; active: boolean; stripeId: string; mode: string };
export type Purchase = { id: string; userId: number; priceId: string; accessKey: string; accessDays: number | null; mode: string;
  subscriptionPriceId: string | null; status: string; sessionId: string | null; subscriptionId: string | null; paymentIntentId: string | null;
  paidUntil: Date | null; invoiceId: string | null; cancelAtPeriodEnd: boolean; createdAt: Date };
type Input = Record<string, unknown>;
const fields = 'id,name,description,access_key,access_days,active,stripe_id,mode,revision';

export async function catalog(tx: Tx, scope: Scope) {
  const { mode } = stripeFor(scope.tenantId);
  return {
    products: await rows<Product>(tx, `SELECT ${fields} FROM modules.products WHERE tenant_id=$1 AND mode=$2 ${scope.admin ? '' : 'AND active'} ORDER BY name,id`, [scope.tenantId, mode]),
    prices: await rows<Price>(tx, `SELECT p.* FROM modules.prices p JOIN modules.products product ON product.tenant_id=p.tenant_id AND product.id=p.product_id WHERE p.tenant_id=$1 AND p.mode=$2 ${scope.admin ? '' : 'AND p.active AND product.active'} ORDER BY p.amount,p.id`, [scope.tenantId, mode]),
    mode,
  };
}
export async function saveProduct(tx: Tx, scope: Scope, input: Input) {
  const id = uuid(input.id); const name = text(input.name, 'name');
  const description = input.description === '' ? '' : text(input.description, 'description', 10000);
  const key = accessKey(input.accessKey); const days = input.accessDays == null ? null : integer(input.accessDays, 'access days', 1, 36500);
  const active = boolean(input.active);
  const { stripe, mode } = stripeFor(scope.tenantId);
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`product:${scope.tenantId}:${id}`]);
  const existing = await one<Product>(tx, 'SELECT * FROM modules.products WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [scope.tenantId, id]);
  if (existing && existing.mode !== mode) return fail(409, 'Switch to the product’s Stripe environment.');
  if (existing && existing.revision !== input.revision) return fail(409, 'Product changed. Reload before saving.');
  const revision = (existing?.revision || 0) + 1;
  const metadata = { tenantId: scope.tenantId, productId: id };
  const params = { name, description, active, metadata };
  const product = existing
    ? await stripe.products.update(existing.stripeId, params, { idempotencyKey: `product:${scope.tenantId}:${id}:${revision}` })
    : await stripe.products.create(params, { idempotencyKey: `product:${scope.tenantId}:${id}:1` });
  await tx.query(`INSERT INTO modules.products(tenant_id,id,name,description,access_key,access_days,active,stripe_id,mode,revision)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(tenant_id,id) DO UPDATE SET name=$3,description=$4,access_key=$5,access_days=$6,active=$7,revision=$10`,
  [scope.tenantId, id, name, description, key, days, active, product.id, mode, revision]);
  return { id, revision };
}
export async function createPrice(tx: Tx, scope: Scope, input: Input) {
  const id = uuid(input.id); const productId = uuid(input.productId);
  const amount = integer(input.amount, 'amount in minor currency units');
  const currency = text(input.currency, 'currency', 3).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) return fail(400, 'Invalid currency.');
  const interval = text(input.interval, 'interval');
  if (!['once', 'month', 'year'].includes(interval)) return fail(400, 'Invalid billing interval.');
  const { stripe, mode } = stripeFor(scope.tenantId);
  const product = await one<Product>(tx, 'SELECT * FROM modules.products WHERE tenant_id=$1 AND id=$2 AND active AND mode=$3 FOR UPDATE', [scope.tenantId, productId, mode]);
  if (!product) return fail(404, 'Active product not found.');
  const existing = await one<Price>(tx, 'SELECT * FROM modules.prices WHERE tenant_id=$1 AND id=$2', [scope.tenantId, id]);
  if (existing) {
    if (existing.productId !== productId || existing.amount !== amount || existing.currency !== currency || existing.interval !== interval) return fail(409, 'Price identifier is already in use.');
    return { id };
  }
  const price = await stripe.prices.create({ product: product.stripeId, unit_amount: amount, currency,
    ...(interval === 'once' ? {} : { recurring: { interval: interval as 'month' | 'year' } }),
    metadata: { tenantId: scope.tenantId, priceId: id } }, { idempotencyKey: `price:${scope.tenantId}:${id}` });
  await tx.query('INSERT INTO modules.prices(tenant_id,id,product_id,amount,currency,interval,stripe_id,mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [scope.tenantId, id, productId, amount, currency, interval, price.id, mode]);
  return { id };
}
export async function archivePrice(tx: Tx, scope: Scope, id: string, active: boolean) {
  const { stripe, mode } = stripeFor(scope.tenantId);
  const price = await one<Price>(tx, 'SELECT * FROM modules.prices WHERE tenant_id=$1 AND id=$2 AND mode=$3 FOR UPDATE', [scope.tenantId, uuid(id), mode]);
  if (!price) return fail(404, 'Price not found.');
  await stripe.prices.update(price.stripeId, { active });
  await tx.query('UPDATE modules.prices SET active=$3 WHERE tenant_id=$1 AND id=$2', [scope.tenantId, id, active]);
  return { id };
}
export async function checkout(tx: Tx, scope: Scope, input: Input, origin: string) {
  const priceId = uuid(input.priceId); const requestKey = uuid(input.requestKey); const userId = scope.actor!.id;
  const { stripe, mode } = stripeFor(scope.tenantId);
  // Serializes retries and customer creation for this buyer. External requests have stable idempotency keys.
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`buyer:${scope.tenantId}:${mode}:${userId}`]);
  let purchase = await one<Purchase>(tx, 'SELECT * FROM modules.purchases WHERE tenant_id=$1 AND user_id=$2 AND request_key=$3 FOR UPDATE', [scope.tenantId, userId, requestKey]);
  if (purchase && (purchase.priceId !== priceId || purchase.mode !== mode)) return fail(409, 'Checkout retry does not match the original purchase.');
  if (purchase?.sessionId) {
    const session = await stripe.checkout.sessions.retrieve(purchase.sessionId);
    return { purchaseId: purchase.id, url: safeStripeUrl(session.url), status: purchase.status };
  }
  const recent = await one<{ count: string }>(tx, "SELECT count(*) FROM modules.purchases WHERE tenant_id=$1 AND user_id=$2 AND created_at>now()-interval '1 hour'", [scope.tenantId, userId]);
  if (Number(recent?.count) >= 20) return fail(429, 'Too many checkout attempts. Try again later.');
  const price = await one<Price & { accessKey: string; accessDays: number | null }>(tx, `SELECT p.*,product.access_key,product.access_days FROM modules.prices p
    JOIN modules.products product ON product.tenant_id=p.tenant_id AND product.id=p.product_id
    WHERE p.tenant_id=$1 AND p.id=$2 AND p.active AND product.active AND p.mode=$3 AND product.mode=$3 FOR SHARE OF p,product`, [scope.tenantId, priceId, mode]);
  if (!price) return fail(404, 'Price is not available.');
  let customer = await one<{ stripeId: string }>(tx, 'SELECT stripe_id FROM modules.customers WHERE tenant_id=$1 AND user_id=$2 AND mode=$3', [scope.tenantId, userId, mode]);
  if (!customer) {
    const created = await stripe.customers.create({ metadata: { tenantId: scope.tenantId, userId: String(userId) } }, { idempotencyKey: `customer:${scope.tenantId}:${mode}:${userId}` });
    await tx.query('INSERT INTO modules.customers VALUES($1,$2,$3,$4)', [scope.tenantId, userId, mode, created.id]);
    customer = { stripeId: created.id };
  }
  const id = purchase?.id || requestKey; // Stable even if the transaction rolls back after Stripe accepts the request.
  if (!purchase) {
    purchase = await one<Purchase>(tx, `INSERT INTO modules.purchases(tenant_id,id,user_id,price_id,request_key,mode,access_key,access_days)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [scope.tenantId, id, userId, priceId, requestKey, mode, price.accessKey, price.accessDays]);
  }
  const metadata = { tenantId: scope.tenantId, purchaseId: id };
  const session = await stripe.checkout.sessions.create({
    mode: price.interval === 'once' ? 'payment' : 'subscription', customer: customer.stripeId,
    client_reference_id: id, metadata, line_items: [{ price: price.stripeId, quantity: 1 }],
    success_url: `${origin}/services?checkout=processing`, cancel_url: `${origin}/services?checkout=cancelled`,
    ...(price.interval === 'once' ? { payment_intent_data: { metadata }, invoice_creation: { enabled: true } } : { subscription_data: { metadata } }),
  }, { idempotencyKey: `checkout:${scope.tenantId}:${mode}:${id}` });
  await tx.query('UPDATE modules.purchases SET session_id=$3 WHERE tenant_id=$1 AND id=$2', [scope.tenantId, id, session.id]);
  return { purchaseId: id, url: safeStripeUrl(session.url), status: 'pending' };
}

export async function purchases(tx: Tx, scope: Scope) {
  const { mode } = stripeFor(scope.tenantId);
  return rows(tx, `SELECT p.id,p.user_id,price.id AS price_id,price.product_id,p.status,p.subscription_id,p.cancel_at_period_end,p.paid_until,p.created_at,
    product.name,price.amount,price.currency,price.interval FROM modules.purchases p
    JOIN modules.prices price ON price.tenant_id=p.tenant_id AND price.id=COALESCE(p.subscription_price_id,p.price_id)
    JOIN modules.products product ON product.tenant_id=price.tenant_id AND product.id=price.product_id
    WHERE p.tenant_id=$1 AND p.mode=$2 ${scope.admin ? '' : 'AND p.user_id=$3'} ORDER BY p.created_at DESC,p.id LIMIT 100`, scope.admin ? [scope.tenantId, mode] : [scope.tenantId, mode, scope.actor!.id]);
}
async function ownedPurchase(tx: Tx, scope: Scope, id: string) {
  const { mode } = stripeFor(scope.tenantId);
  const purchase = await one<Purchase>(tx, `SELECT * FROM modules.purchases WHERE tenant_id=$1 AND id=$2 AND mode=$3 ${scope.admin ? '' : 'AND user_id=$4'} FOR UPDATE`, scope.admin ? [scope.tenantId, uuid(id), mode] : [scope.tenantId, uuid(id), mode, scope.actor!.id]);
  if (!purchase) return fail(404, 'Purchase not found.');
  return purchase;
}
export async function documents(tx: Tx, scope: Scope, id: string) {
  const purchase = await ownedPurchase(tx, scope, id); const { stripe } = stripeFor(scope.tenantId);
  const result: { kind: string; status: string; url: string }[] = [];
  if (purchase.subscriptionId) {
    const list = await stripe.invoices.list({ subscription: purchase.subscriptionId, limit: 100 });
    for (const invoice of list.data) {
      const url = safeStripeUrl(invoice.hosted_invoice_url);
      if (url) result.push({ kind: 'invoice', status: invoice.status || 'unknown', url });
    }
  } else if (purchase.invoiceId) {
    const invoice = await stripe.invoices.retrieve(purchase.invoiceId);
    const url = safeStripeUrl(invoice.hosted_invoice_url);
    if (url) result.push({ kind: 'invoice', status: invoice.status || 'unknown', url });
  }
  if (purchase.paymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(purchase.paymentIntentId, { expand: ['latest_charge'] });
    const charge = intent.latest_charge;
    if (charge && typeof charge !== 'string') {
      const url = safeStripeUrl(charge.receipt_url);
      if (url) result.push({ kind: 'receipt', status: charge.refunded ? 'refunded' : 'paid', url });
    }
  }
  return result;
}
export async function subscriptionAction(tx: Tx, scope: Scope, id: string, input: Input) {
  const purchase = await ownedPurchase(tx, scope, id); const { stripe } = stripeFor(scope.tenantId);
  if (!purchase.subscriptionId) return fail(409, 'This purchase is not a subscription.');
  if (input.priceId) {
    if (!scope.admin) return fail(403, 'Tenant administration is required to change prices.');
    const priceId = uuid(input.priceId); const requestKey = uuid(input.requestKey);
    const price = await one<Price>(tx, `SELECT replacement.* FROM modules.prices replacement JOIN modules.prices original
      ON original.tenant_id=replacement.tenant_id AND original.product_id=replacement.product_id
      WHERE original.tenant_id=$1 AND original.id=$2 AND replacement.id=$3 AND replacement.active AND replacement.interval<>'once' AND replacement.mode=$4`, [scope.tenantId, purchase.priceId, priceId, purchase.mode]);
    if (!price) return fail(400, 'Choose an active recurring price for the same product.');
    const subscription = await stripe.subscriptions.retrieve(purchase.subscriptionId);
    if (subscription.items.data.length !== 1) return fail(409, 'This subscription has an unsupported item configuration.');
    await stripe.subscriptions.update(purchase.subscriptionId, {
      items: [{ id: subscription.items.data[0].id, price: price.stripeId }],
      payment_behavior: 'pending_if_incomplete', proration_behavior: 'always_invoice',
    }, { idempotencyKey: `plan:${scope.tenantId}:${id}:${requestKey}` });
  } else {
    const cancelAtPeriodEnd = boolean(input.cancelAtPeriodEnd);
    await stripe.subscriptions.update(purchase.subscriptionId, { cancel_at_period_end: cancelAtPeriodEnd });
  }
  await reconcile(tx, scope.tenantId, purchase.id);
  return { id };
}
export async function refund(tx: Tx, scope: Scope, id: string, input: Input) {
  const purchase = await ownedPurchase(tx, scope, id); const { stripe } = stripeFor(scope.tenantId);
  if (!purchase.paymentIntentId) return fail(409, 'No refundable payment is available. Refresh payment status and retry.');
  const requestKey = uuid(input.requestKey);
  await stripe.refunds.create({ payment_intent: purchase.paymentIntentId }, { idempotencyKey: `refund:${scope.tenantId}:${id}:${requestKey}` });
  await reconcile(tx, scope.tenantId, purchase.id);
  return { id };
}
export async function portal(tx: Tx, scope: Scope, origin: string) {
  const { stripe, mode } = stripeFor(scope.tenantId);
  const customer = await one<{ stripeId: string }>(tx, 'SELECT stripe_id FROM modules.customers WHERE tenant_id=$1 AND user_id=$2 AND mode=$3', [scope.tenantId, scope.actor!.id, mode]);
  if (!customer) return fail(404, 'No billing account found.');
  const configuration = await one<{ portalId: string }>(tx, `SELECT portal_${mode}_id AS portal_id FROM modules.config WHERE tenant_id=$1`, [scope.tenantId]);
  if (!configuration?.portalId) return fail(409, 'The site administrator needs to configure the billing portal.');
  const session = await stripe.billingPortal.sessions.create({ customer: customer.stripeId, configuration: configuration.portalId, return_url: `${origin}/services` });
  return { url: safeStripeUrl(session.url) };
}


export async function configurePortal(tx: Tx, scope: Scope) {
  const { stripe, mode } = stripeFor(scope.tenantId);
  const existing = await one<{ portalId: string }>(tx, `SELECT portal_${mode}_id AS portal_id FROM modules.config WHERE tenant_id=$1 FOR UPDATE`, [scope.tenantId]);
  const params = { features: {
    invoice_history: { enabled: true }, payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ['address', 'email', 'name', 'tax_id'] as ('address' | 'email' | 'name' | 'tax_id')[] },
    subscription_cancel: { enabled: true, mode: 'at_period_end' as const, proration_behavior: 'none' as const },
  }, metadata: { tenantId: scope.tenantId } };
  const result = existing?.portalId ? await stripe.billingPortal.configurations.update(existing.portalId, params)
    : await stripe.billingPortal.configurations.create(params, { idempotencyKey: `portal:${scope.tenantId}:${mode}` });
  await tx.query(`UPDATE modules.config SET portal_${mode}_id=$2 WHERE tenant_id=$1`, [scope.tenantId, result.id]);
  return { configured: true, mode };
}
async function chargeProblem(stripe: Stripe, charge: Stripe.Charge): Promise<'refunded' | 'disputed' | null> {
  if (charge.amount_refunded > 0) return 'refunded';
  if (charge.disputed) {
    const disputes = await stripe.disputes.list({ charge: charge.id, limit: 100 });
    if (disputes.data.length === 0 || disputes.data.some(dispute => !['won', 'warning_closed'].includes(dispute.status))) return 'disputed';
  }
  return null;
}

/** Always retrieve current Stripe state. Event delivery order never determines access. */
export async function reconcile(tx: Tx, tenantId: string, purchaseId: string) {
  const { stripe, mode } = stripeFor(tenantId);
  const purchase = await one<Purchase>(tx, 'SELECT * FROM modules.purchases WHERE tenant_id=$1 AND id=$2 AND mode=$3 FOR UPDATE', [tenantId, purchaseId, mode]);
  if (!purchase?.sessionId) return fail(409, 'Checkout is not ready. Retry this event.');
  const session = await stripe.checkout.sessions.retrieve(purchase.sessionId, { expand: ['line_items'] });
  const customer = await one<{ stripeId: string }>(tx, 'SELECT stripe_id FROM modules.customers WHERE tenant_id=$1 AND user_id=$2 AND mode=$3', [tenantId, purchase.userId, mode]);
  const price = await one<Price>(tx, 'SELECT * FROM modules.prices WHERE tenant_id=$1 AND id=$2', [tenantId, purchase.priceId]);
  if (session.livemode !== (mode === 'live') || session.metadata?.tenantId !== tenantId || session.metadata?.purchaseId !== purchaseId
    || providerId(session.customer) !== customer?.stripeId || session.line_items?.data.length !== 1
    || session.line_items.data[0].price?.id !== price?.stripeId || session.line_items.data[0].quantity !== 1 || session.currency !== price?.currency || session.amount_subtotal !== price?.amount) return fail(409, 'Payment verification failed.');
  let status = session.status === 'expired' ? 'expired' : 'pending';
  let paidUntil = purchase.paidUntil; let revoke = false; let cancel = false;
  let invoiceId = providerId(session.invoice); let intentId = providerId(session.payment_intent);
  let currentPriceId: string | null = null;
  const subscriptionId = providerId(session.subscription);
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
    if (subscription.items.data.length !== 1) return fail(409, 'Unsupported subscription item configuration.');
    const currentPrice = await one<Price>(tx, `SELECT p.* FROM modules.prices p JOIN modules.prices original ON original.tenant_id=p.tenant_id AND original.product_id=p.product_id WHERE p.tenant_id=$1 AND p.stripe_id=$2 AND p.mode=$3 AND original.id=$4`, [tenantId, subscription.items.data[0].price.id, mode, purchase.priceId]);
    if (!currentPrice) return fail(409, 'Subscription price is not part of this product.');
    currentPriceId = currentPrice.id;
    if (subscription.metadata.tenantId !== tenantId || subscription.metadata.purchaseId !== purchaseId || providerId(subscription.customer) !== customer?.stripeId) return fail(409, 'Subscription verification failed.');
    status = subscription.status; cancel = subscription.cancel_at_period_end;
    invoiceId = providerId(subscription.latest_invoice);
    const invoice = subscription.latest_invoice;
    if (invoice && typeof invoice !== 'string' && invoice.status === 'paid') {
      // Only the paid line's period can extend access. An unpaid renewal cannot do so.
      const lines = invoice.lines.data.filter(line => line.pricing?.price_details?.price === currentPrice.stripeId);
      const periodEnd = Math.max(0, ...lines.map(line => line.period.end));
      const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: 'paid', limit: 100 });
      if (payments.has_more) return fail(409, 'Invoice has too many payments to reconcile safely.');
      for (const payment of payments.data) {
        const paymentIntentId = providerId(payment.payment.payment_intent);
        if (!paymentIntentId) continue;
        intentId = paymentIntentId;
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
        const charge = intent.latest_charge;
        if (charge && typeof charge !== 'string') {
          const problem = await chargeProblem(stripe, charge);
          if (problem) { status = problem; revoke = true; }
        }
      }
      if (periodEnd && (!paidUntil || paidUntil.getTime() < periodEnd * 1000)) paidUntil = new Date(periodEnd * 1000);
    }
    revoke ||= ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(status);
  } else if (intentId) {
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
    const charge = intent.latest_charge;
    if (intent.metadata.tenantId !== tenantId || intent.metadata.purchaseId !== purchaseId || providerId(intent.customer) !== customer?.stripeId) return fail(409, 'Payment verification failed.');
    const problem = charge && typeof charge !== 'string' ? await chargeProblem(stripe, charge) : null;
    if (problem) {
      status = problem; revoke = true;
    } else if (session.payment_status === 'paid' && intent.status === 'succeeded') {
      status = 'paid';
      // Anchor duration to Stripe payment time; replays never prolong access.
      paidUntil = purchase.accessDays ? new Date((charge && typeof charge !== 'string' ? charge.created : session.created) * 1000 + purchase.accessDays * 86400000) : null;
    } else if (intent.status === 'canceled') status = 'failed';
  }
  await tx.query(`UPDATE modules.purchases SET status=$3,subscription_id=$4,payment_intent_id=$5,invoice_id=$6,
    cancel_at_period_end=$7,paid_until=$8,subscription_price_id=$9,updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, purchaseId, status, subscriptionId, intentId, invoiceId, cancel, paidUntil, currentPriceId]);
  if (revoke) await tx.query("UPDATE modules.grants SET revoked=true WHERE tenant_id=$1 AND source='purchase' AND source_id=$2", [tenantId, purchaseId]);
  else if (status === 'paid' || (subscriptionId && paidUntil && paidUntil > new Date())) {
    await tx.query(`INSERT INTO modules.grants(tenant_id,id,user_id,access_key,source,source_id,ends_at,starts_at)
      VALUES($1,$2,$3,$4,'purchase',$5,$6,$7) ON CONFLICT(tenant_id,source,source_id,access_key)
      DO UPDATE SET ends_at=EXCLUDED.ends_at,revoked=false`, [tenantId, randomUUID(), purchase.userId, purchase.accessKey, purchaseId, paidUntil, purchase.createdAt]);
  }
  return { status };
}

export async function webhook(tx: Tx, tenantId: string, raw: string, signature: string) {
  const { stripe, mode, webhookSecret } = stripeFor(tenantId);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(raw, signature, webhookSecret); }
  catch { return fail(400, 'Invalid Stripe signature.'); }
  if (event.livemode !== (mode === 'live')) return fail(400, 'Wrong payment environment.');
  const accepted = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'charge.dispute.updated', 'refund.created', 'refund.updated', 'refund.failed'];
  if (!accepted.includes(event.type)) return { received: true };
  const inserted = await one(tx, 'INSERT INTO modules.webhook_events(tenant_id,mode,id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id', [tenantId, mode, event.id]);
  if (!inserted) return { received: true };
  const object = event.data.object;
  let purchaseId: string | undefined;
  if ('metadata' in object && object.metadata?.tenantId === tenantId) purchaseId = object.metadata.purchaseId;
  let subscriptionId: string | null = null; let paymentIntentId: string | null = null;
  if (object.object === 'invoice') subscriptionId = providerId(object.parent?.subscription_details?.subscription);
  if (object.object === 'subscription') subscriptionId = object.id;
  if (object.object === 'refund') paymentIntentId = providerId(object.payment_intent);
  if (object.object === 'charge') paymentIntentId = providerId(object.payment_intent);
  if (object.object === 'dispute') {
    const charge = await stripe.charges.retrieve(providerId(object.charge)!);
    paymentIntentId = providerId(charge.payment_intent);
  }
  if (!purchaseId && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.metadata.tenantId === tenantId) purchaseId = subscription.metadata.purchaseId;
  }
  if (!purchaseId && paymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata.tenantId === tenantId) purchaseId = intent.metadata.purchaseId;
    if (!purchaseId) {
      const payments = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntentId }, limit: 100 });
      for (const payment of payments.data) {
        const invoice = await stripe.invoices.retrieve(providerId(payment.invoice)!);
        const relatedSubscription = providerId(invoice.parent?.subscription_details?.subscription);
        if (!relatedSubscription) continue;
        const subscription = await stripe.subscriptions.retrieve(relatedSubscription);
        if (subscription.metadata.tenantId === tenantId) { purchaseId = subscription.metadata.purchaseId; break; }
      }
    }
  }
  if (purchaseId) await reconcile(tx, tenantId, uuid(purchaseId));
  return { received: true };
}
export async function grants(tx: Tx, scope: Scope) {
  return rows(tx, `SELECT g.* FROM modules.grants g WHERE tenant_id=$1 ${scope.admin ? '' : `AND (user_id=$2 OR organization_id IN (SELECT organization_id FROM modules.memberships WHERE tenant_id=$1 AND user_id=$2 AND active AND (valid_until IS NULL OR valid_until>now())))`} ORDER BY starts_at DESC LIMIT 100`, scope.admin ? [scope.tenantId] : [scope.tenantId, scope.actor!.id]);
}
export async function hasAccess(tx: Tx, scope: Scope, key: string) {
  return Boolean(await one(tx, `SELECT id FROM modules.grants WHERE tenant_id=$1 AND access_key=$3 AND NOT revoked AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
    AND (user_id=$2 OR organization_id IN (SELECT organization_id FROM modules.memberships WHERE tenant_id=$1 AND user_id=$2 AND active AND (valid_until IS NULL OR valid_until>now()))) LIMIT 1`, [scope.tenantId, scope.actor!.id, accessKey(key)]));
}
export async function saveGrant(tx: Tx, scope: Scope, input: Input) {
  const id = uuid(input.id); const key = accessKey(input.accessKey); const organizationId = input.organizationId ? uuid(input.organizationId) : null;
  const userId = organizationId ? null : integer(input.userId, 'user'); const expires = date(input.endsAt); const reason = text(input.reason, 'reason', 1000);
  await tx.query(`INSERT INTO modules.grants(tenant_id,id,user_id,organization_id,access_key,source,source_id,ends_at,reason,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$2,$7,$8,$9) ON CONFLICT(tenant_id,id) DO NOTHING`, [scope.tenantId, id, userId, organizationId, key, organizationId ? 'organization' : 'admin', expires, reason, scope.actor!.id]);
  return { id };
}
