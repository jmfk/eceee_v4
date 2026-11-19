import { database } from '../../src/db';
import { siteContext, publicOrigin } from '../../src/website';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const host = request.headers.get('host') || '';
  const site = await siteContext(database, host, false);
  if (!site) return new Response('Site not found.', { status: 404 });
  return new Response(`User-agent: *\nDisallow: /api/\nDisallow: /site-tools/\nSitemap: ${publicOrigin(host)}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
