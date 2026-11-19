import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/db', () => ({ database: { withSnapshot: (fn: (db: unknown) => unknown) => fn({ root: async () => ({ tenant_id: '10000000-0000-0000-0000-000000000001' }) }) } }));
import { scope } from '../src/modules/auth';
import { sameOrigin } from '../src/modules/validation';
const tenant = '10000000-0000-0000-0000-000000000001';
const request = () => new Request('https://app.test/api/modules/admin/products', { headers: { host: 'app.test', 'x-tenant-id': tenant, cookie: 'sessionid=synthetic' } });
afterEach(() => vi.unstubAllGlobals());
describe('module authorization boundary', () => {
  it('does not treat an authenticated customer as a tenant administrator', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ meta: { is_authenticated: true }, data: { user: { id: 1 } } }))
      .mockResolvedValueOnce(Response.json({ id: 1, currentWorkspace: { id: tenant }, permissions: ['page.read'] })));
    await expect(scope(request(), true, true)).rejects.toMatchObject({ status: 403 });
  });
  it('rejects a permissions response scoped to a different tenant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ meta: { is_authenticated: true }, data: { user: { id: 1 } } }))
      .mockResolvedValueOnce(Response.json({ id: 1, currentWorkspace: { id: 'other' }, permissions: ['tenant.admin'] })));
    await expect(scope(request(), true, true)).rejects.toMatchObject({ status: 403 });
  });
  it('rejects an incomplete MFA session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ meta: { is_authenticated: false }, data: { user: { id: 1 } } })));
    await expect(scope(request(), true, true)).rejects.toMatchObject({ status: 401 });
  });
  it('allows tenant administrators with a matching session and exact workspace', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ meta: { is_authenticated: true }, data: { user: { id: 1 } } }))
      .mockResolvedValueOnce(Response.json({ id: 1, currentWorkspace: { id: tenant }, permissions: ['tenant.admin'] }));
    vi.stubGlobal('fetch', fetcher);
    expect(await scope(request(), true, true)).toMatchObject({ tenantId: tenant, admin: true, actor: { id: 1 } });
    expect(fetcher.mock.calls[1][1].headers['X-Tenant-ID']).toBe(tenant);
  });
  it.each([undefined, 'null', 'https://attacker.test', 'http://app.test'])('rejects a mutation from %s', origin => {
    const headers: Record<string, string> = { host: 'app.test' }; if (origin) headers.origin = origin;
    expect(() => sameOrigin(new Request('https://app.test', { method: 'POST', headers }))).toThrow('Use this site');
  });
  it('accepts a same-origin browser mutation', () => {
    expect(() => sameOrigin(new Request('https://app.test', { method: 'POST', headers: { host: 'app.test', origin: 'https://app.test' } }))).not.toThrow();
  });
});
