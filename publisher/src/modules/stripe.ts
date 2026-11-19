import Stripe from 'stripe';
import { fail } from './validation';

export function stripeFor(tenantId: string): { stripe: Stripe; mode: 'test' | 'live'; webhookSecret: string } {
  const prefix = `ECEEE_STRIPE_${tenantId.replaceAll('-', '').toUpperCase()}`;
  const mode = process.env[`${prefix}_MODE`];
  const key = process.env[`${prefix}_SECRET_KEY`] || '';
  const webhookSecret = process.env[`${prefix}_WEBHOOK_SECRET`] || '';
  if ((mode !== 'test' && mode !== 'live') || !key.startsWith(`sk_${mode}_`) || !webhookSecret.startsWith('whsec_')) return fail(503, 'Stripe is not configured for this tenant.');
  return { stripe: new Stripe(key, { maxNetworkRetries: 2, timeout: 8000 }), mode, webhookSecret };
}
export function providerId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === 'string' ? value : value?.id || null;
}
export function safeStripeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && /^(checkout|billing|invoice|pay)\.stripe\.com$/.test(url.hostname) ? url.href : null; }
  catch { return null; }
}
