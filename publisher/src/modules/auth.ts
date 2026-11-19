import { database } from '../db';
import { contentHostname } from '../hostname';
import { fail, uuid } from './validation';

export type Actor = { id: number; name: string };
export type Scope = { tenantId: string; actor?: Actor; admin: boolean };
export async function identity(request: Request): Promise<Actor> {
  const response = await backend(request, '/_allauth/browser/v1/auth/session');
  if (!response.ok) return fail(401, 'Sign in to continue.');
  const session = await response.json();
  if (session.meta?.is_authenticated !== true || !Number.isSafeInteger(session.data?.user?.id)) return fail(401, 'Sign in to continue.');
  return { id: session.data.user.id, name: String(session.data.user.display || session.data.user.username || 'Member').slice(0, 200) };
}
async function backend(request: Request, path: string, tenantId?: string): Promise<Response> {
  const base = process.env.PUBLISHER_AUTH_ORIGIN || 'http://backend:8000';
  return fetch(new URL(path, base), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000), headers: {
    cookie: request.headers.get('cookie') || '', host: request.headers.get('host') || '',
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
  } });
}
export async function scope(request: Request, admin: boolean, signedIn: boolean): Promise<Scope> {
  if (admin) {
    const tenantId = uuid(request.headers.get('x-tenant-id'));
    const actor = await identity(request);
    const response = await backend(request, '/api/v1/utils/current-user/', tenantId);
    if (!response.ok) return fail(403, 'Tenant administration is required.');
    const user = await response.json();
    if (user.id !== actor.id || user.currentWorkspace?.id !== tenantId
      || !user.permissions?.includes('tenant.admin') || user.userPerspective) return fail(403, 'Tenant administration is required.');
    return { tenantId, actor, admin: true };
  }
  const hostname = contentHostname(request.headers.get('host') || '');
  const tenantId = await database.withSnapshot(async reader => (await reader.root(hostname))?.tenant_id);
  if (!tenantId) return fail(404, 'Site not found.');
  return { tenantId: String(tenantId), admin: false, ...(signedIn ? { actor: await identity(request) } : {}) };
}
