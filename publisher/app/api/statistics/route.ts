import { database } from '../../../src/db';
import { siteContext, safePath, publicOrigin } from '../../../src/website';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const windows = new Map<string, { at: number; count: number }>();
export async function POST(request: Request) {
  const host = request.headers.get('host') || '';
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 204 });
  if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('origin') && request.headers.get('origin') !== publicOrigin(host)) return new Response(null, { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return new Response(null, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let body = '';
  let size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 4096) { await reader.cancel(); return new Response(null, { status: 413 }); }
    body += decoder.decode(part.value, { stream: true });
  }
  let input;
  try { input = JSON.parse(body + decoder.decode()); } catch { return new Response(null, { status: 400 }); }
  try {
    if (!input || typeof input.path !== 'string' || input.path.length > 1500 || !safePath(input.path)) return new Response(null, { status: 400 });
    const site = await siteContext(database, host, false);
    if (!site || !site.settings.analyticsEnabled || site.settings.analyticsRequireConsent && input.consent !== true) return new Response(null, { status: 403 });
    const now = Date.now();
    for (const [key, value] of windows) if (now - value.at >= 60000) windows.delete(key);
    const window = windows.get(site.root.id) ?? { at: now, count: 0 };
    if (++window.count > 300) return new Response(null, { status: 429 });
    windows.set(site.root.id, window);
    const endpoint = process.env.PUBLISHER_STATISTICS_ENDPOINT || 'http://backend:8000/api/v1/statistics/ingest/';
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
      headers: { 'Content-Type': 'application/json', 'Host': host, 'X-Forwarded-Proto': publicOrigin(host).startsWith('https:') ? 'https' : 'http' },
      body: JSON.stringify({ tenant_id: site.root.tenant_id, events: [{ event_type: 'pageview', url: new URL(input.path, publicOrigin(host)).href }] }) });
    return new Response(null, { status: response.ok ? 202 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch { return new Response(null, { status: 503 }); }
}
