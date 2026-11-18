import { scope, type Scope } from './auth';
import * as commerce from './commerce';
import * as community from './community';
import { transaction, one, rows, type Tx } from './store';
import { body, boolean, date, fail, integer, ModuleError, sameOrigin, requestOrigin, text, uuid } from './validation';

type Config = { commerce: boolean; support: boolean; faq: boolean; forum: boolean };
const disabled: Config = { commerce: false, support: false, faq: false, forum: false };
async function config(tx: Tx, tenantId: string): Promise<Config> {
  return await one<Config>(tx, 'SELECT commerce,support,faq,forum FROM modules.config WHERE tenant_id=$1', [tenantId]) || disabled;
}
function enabled(value: boolean) { if (!value) fail(404, 'This module is not enabled.'); }

export async function handleModules(request: Request, parts: string[]): Promise<Response> {
  try {
    const method = request.method; const isWrite = method === 'POST';
    if (method !== 'GET' && !isWrite) return fail(405, 'Method not allowed.');
    if (parts[0] === 'webhook' && parts.length === 2 && isWrite) {
      const tenantId = uuid(parts[1]); const raw = await body(request, 1024 * 1024);
      const result = await transaction(tenantId, async tx => {
        // Pausing sales must not stop renewals, refunds or cancellation reconciliation.
        return commerce.webhook(tx, tenantId, raw, request.headers.get('stripe-signature') || '');
      });
      return json(result);
    }
    if (isWrite) sameOrigin(request);
    const admin = parts[0] === 'admin'; const path = admin ? parts.slice(1) : parts;
    const route = path.join('/');
    const signedIn = admin || !(['config', 'products', 'faqs'].includes(route));
    const context = await scope(request, admin, signedIn);
    let input: Record<string, unknown> = {};
    if (isWrite) {
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return fail(415, 'Send JSON.');
      try { const parsed: unknown = JSON.parse(await body(request));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(400, 'Invalid JSON object.');
        input = parsed as Record<string, unknown>;
      } catch (error) { if (error instanceof ModuleError) throw error; return fail(400, 'Invalid JSON.'); }
    }
    const result = await transaction(context.tenantId, async tx => dispatch(tx, context, path, isWrite, input, request));
    return json(result);
  } catch (error) {
    if (error instanceof ModuleError) return json({ error: error.message }, error.status);
    // Do not log Stripe requests, payloads, cookies, DB URLs or provider error messages.
    console.error('[modules] request failed', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'Could not complete this request. Please retry.' }, 503);
  }
}
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host, X-Tenant-ID', 'X-Content-Type-Options': 'nosniff' } });
async function dispatch(tx: Tx, context: Scope, path: string[], write: boolean, input: Record<string, unknown>, request: Request): Promise<unknown> {
  const route = path.join('/'); const settings = await config(tx, context.tenantId);
  const origin = requestOrigin(request);
  if (route === 'config') {
    if (!write) return settings;
    if (!context.admin) return fail(403, 'Tenant administration is required.');
    const values = ['commerce', 'support', 'faq', 'forum'].map(key => boolean(input[key]));
    await tx.query(`INSERT INTO modules.config(tenant_id,commerce,support,faq,forum) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(tenant_id) DO UPDATE SET commerce=$2,support=$3,faq=$4,forum=$5,updated_at=now()`, [context.tenantId, ...values]);
    return config(tx, context.tenantId);
  }
  if (['products', 'prices', 'purchases', 'account', 'checkout', 'portal', 'portal-configuration', 'grants', 'organizations', 'memberships', 'access'].includes(path[0])) {
    // Existing customers retain account/history access after stopping new sales.
    if (!['account', 'purchases', 'portal', 'access'].includes(path[0])) enabled(settings.commerce);
    if (route === 'products' && !write) return commerce.catalog(tx, context);
    if (route === 'products' && write && context.admin) return commerce.saveProduct(tx, context, input);
    if (route === 'prices' && write && context.admin) return commerce.createPrice(tx, context, input);
    if (path[0] === 'prices' && path.length === 2 && write && context.admin) return commerce.archivePrice(tx, context, path[1], boolean(input.active));
    if (route === 'checkout' && write && !context.admin) return commerce.checkout(tx, context, input, origin);
    if (route === 'portal-configuration' && write && context.admin) return commerce.configurePortal(tx, context);
    if (route === 'portal' && write && !context.admin) return commerce.portal(tx, context, origin);
    if (route === 'account' && !write) return { purchases: await commerce.purchases(tx, context), grants: await commerce.grants(tx, context) };
    if (route === 'purchases' && !write && context.admin) return commerce.purchases(tx, context);
    if (path[0] === 'purchases' && path.length === 3) {
      if (path[2] === 'documents' && !write) return commerce.documents(tx, context, path[1]);
      if (path[2] === 'subscription' && write) return commerce.subscriptionAction(tx, context, path[1], input);
      if (path[2] === 'refund' && write && context.admin) return commerce.refund(tx, context, path[1], input);
      if (path[2] === 'reconcile' && write && context.admin) return commerce.reconcile(tx, context.tenantId, uuid(path[1]));
    }
    if (path[0] === 'access' && path.length === 2 && !write) return { allowed: await commerce.hasAccess(tx, context, path[1]) };
    if (route === 'grants' && context.admin) return write ? commerce.saveGrant(tx, context, input) : commerce.grants(tx, context);
    if (path[0] === 'grants' && path.length === 2 && write && context.admin) {
      const grant = await one(tx, "UPDATE modules.grants SET revoked=$3 WHERE tenant_id=$1 AND id=$2 AND source<>'purchase' RETURNING id", [context.tenantId, uuid(path[1]), boolean(input.revoked)]);
      return grant || fail(404, 'Administrative grant not found.');
    }
    if (route === 'organizations' && context.admin) {
      if (!write) return rows(tx, 'SELECT * FROM modules.organizations WHERE tenant_id=$1 ORDER BY name,id LIMIT 100', [context.tenantId]);
      const id = uuid(input.id);
      await tx.query('INSERT INTO modules.organizations(tenant_id,id,name) VALUES($1,$2,$3) ON CONFLICT(tenant_id,id) DO UPDATE SET name=$3', [context.tenantId, id, text(input.name, 'name')]);
      return { id };
    }
    if (route === 'memberships' && context.admin) {
      if (!write) return rows(tx, 'SELECT * FROM modules.memberships WHERE tenant_id=$1 ORDER BY organization_id,user_id LIMIT 100', [context.tenantId]);
      await tx.query(`INSERT INTO modules.memberships(tenant_id,organization_id,user_id,valid_until,active) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(tenant_id,organization_id,user_id) DO UPDATE SET valid_until=$4,active=$5`, [context.tenantId, uuid(input.organizationId), integer(input.userId, 'user'), date(input.validUntil), boolean(input.active)]);
      return { saved: true };
    }
  }
  if (route === 'faqs') { enabled(settings.faq);
    if (!write) return community.faqs(tx, context);
    if (context.admin) return community.saveFaq(tx, context, input);
  }
  if (path[0] === 'threads') {
    if (path.length === 1) {
      const kind = write ? String(input.kind) : new URL(request.url).searchParams.get('kind') || 'forum';
      enabled(kind === 'support' ? settings.support : settings.forum);
      return write ? community.createThread(tx, context, input) : community.threads(tx, context, kind);
    }
    if (path.length === 2) {
      const thread = await community.visibleThread(tx, context, path[1]);
      enabled(thread.kind === 'support' ? settings.support : settings.forum);
      return write ? (context.admin && (input.status !== undefined || input.messageId) ? community.moderate(tx, context, path[1], input) : community.reply(tx, context, path[1], input))
        : community.messages(tx, context, path[1], new URL(request.url).searchParams.get('before'));
    }
  }
  return fail(404, 'Module action not found.');
}
