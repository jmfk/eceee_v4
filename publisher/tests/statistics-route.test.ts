import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ site: vi.fn(), fetch: vi.fn() }));
vi.mock('../src/db', () => ({ database: {} }));
vi.mock('../src/website', async importOriginal => ({ ...await importOriginal<typeof import('../src/website')>(), siteContext: mocks.site }));
import { POST } from '../app/api/statistics/route';
function request(body: unknown, headers = {}) {
  return new Request('https://example.org/api/statistics', { method: 'POST', headers: { host: 'example.org', origin: 'https://example.org', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  mocks.site.mockResolvedValue({ root: { id: '1', tenant_id: 'tenant-a' }, settings: { analyticsEnabled: true, analyticsRequireConsent: true } });
  mocks.fetch.mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', mocks.fetch); mocks.fetch.mockClear();
});
describe('anonymous statistics boundary', () => {
  it('honors browser privacy headers without forwarding an event', async () => {
    expect((await POST(request({ path: '/', consent: true }, { dnt: '1' }))).status).toBe(204);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('routes statistics to the publisher before Django and preserves public HTTPS behind Caddy', async () => {
    const caddy = readFileSync(new URL('../../deploy/Caddyfile', import.meta.url), 'utf8');
    expect(caddy.indexOf('handle /api/statistics')).toBeGreaterThan(0);
    expect(caddy.indexOf('handle /api/statistics')).toBeLessThan(caddy.indexOf('handle /api/*'));
    const proxied = new Request('http://publisher:3000/api/statistics', { method: 'POST', headers: { host: 'example.org', origin: 'https://example.org', 'content-type': 'application/json' }, body: JSON.stringify({ path: '/', consent: true }) });
    expect((await POST(proxied)).status).toBe(202);
    expect(mocks.fetch.mock.calls[0][1].headers).toMatchObject({ Host: 'example.org', 'X-Forwarded-Proto': 'https' });
  });
  it('requires consent before contacting ingestion', async () => {
    expect((await POST(request({ path: '/news/' }))).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('forwards only the resolved site and a URL without query data or identifiers', async () => {
    expect((await POST(request({ path: '/news/', consent: true, tenant_id: 'other', user_id: 'email@example.org' }))).status).toBe(202);
    const forwarded = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(forwarded).toEqual({ tenant_id: 'tenant-a', events: [{ event_type: 'pageview', url: 'https://example.org/news/' }] });
  });
  it('rejects cross-site requests and URLs with query data', async () => {
    expect((await POST(request({ path: '/news/', consent: true }, { origin: 'https://outside.org' }))).status).toBe(403);
    expect((await POST(request({ path: '/news/?email=private', consent: true }))).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not forward events when statistics are disabled', async () => {
    mocks.site.mockResolvedValue({ root: { id: '1' }, settings: { analyticsEnabled: false } });
    expect((await POST(request({ path: '/', consent: true }))).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
