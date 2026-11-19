import { archiveRoute } from '../../src/archive-route';
import { database } from '../../src/db';
import { siteContext, publicOrigin, websiteSettings, safePath, xmlEscape, canonicalPath, archiveTypes, type ArchiveKind } from '../../src/website';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const host = request.headers.get('host') || '';
    const site = await siteContext(database, host);
    if (!site) return new Response('Site not found.', { status: 404 });
    const urls = site.pages.filter(page => !websiteSettings(page.pageData).noIndex && safePath(page.path)).map(page =>
      `<url><loc>${xmlEscape(new URL(canonicalPath(page.path), publicOrigin(host)).href)}</loc><lastmod>${xmlEscape(new Date(page.updatedAt).toISOString())}</lastmod></url>`);
    for (const kind of Object.keys(archiveTypes) as ArchiveKind[]) {
      const route = await archiveRoute(database, host, site.pages.filter(page => !websiteSettings(page.pageData).noIndex), kind);
      if (!route) continue;
      for (let offset = 0; urls.length < 50000; offset += 50) {
        const items = await database.withSnapshot(reader => reader.publishedObjects({
          ...route.query, archiveTypeNames: archiveTypes[kind], articleKind: kind === 'news' ? 'news' : undefined,
          activeTypeOnly: true, limit: Math.min(50, 50000 - urls.length), offset, sortOrder: '-publish_date',
        }, site.root.tenant_id, new Date()));
        for (const item of items) urls.push(`<url><loc>${xmlEscape(new URL(`${route.path === '/' ? '' : route.path}/${encodeURIComponent(item.slug)}`, publicOrigin(host)).href)}</loc></url>`);
        if (items.length < 50) break;
      }
    }
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch { return new Response('Sitemap is temporarily unavailable.', { status: 503 }); }
}
