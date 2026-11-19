import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { database } from '@/src/db';
import { siteContext } from '@/src/website';
import { archiveRoute } from '@/src/archive-route';
import { archiveQuery } from '@/src/archive';
import { WebsiteTools } from '@/src/website-tools';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search and archives', robots: { index: false, follow: true } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const host = (await headers()).get('host') || '';
  const site = await siteContext(database, host);
  if (!site) notFound();
  const input = await searchParams;
  const params = new URLSearchParams(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const parsed = archiveQuery(params);
  const route = parsed ? await archiveRoute(database, host, site.pages, parsed.kind) : null;
  const items = parsed && route ? await database.withSnapshot(reader => reader.publishedObjects({ ...parsed.query, ...route.query }, site.root.tenant_id, new Date())) : [];
  const pageHref = (page: number) => { const copy = new URLSearchParams(params); copy.set('page', String(page)); return `?${copy}`; };
  return <main className="eceee-site-search" style={{ maxWidth: 960, margin: 'auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
    <WebsiteTools info={{ language: site.settings.language || 'en', translations: [], analyticsEnabled: site.settings.analyticsEnabled, analyticsRequireConsent: site.settings.analyticsRequireConsent }} />
    <a href="/">Home</a><h1>Search and archives</h1>
    <form method="get" role="search" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end', marginBlock: 24 }}>
      <label>Search<input name="q" type="search" maxLength={200} defaultValue={params.get('q') || ''} /></label>
      <label>Content<select name="kind" defaultValue={params.get('kind') || 'news'}>
        <option value="news">News</option><option value="publications">Publications</option><option value="events">Events</option>
      </select></label>
      <label>From<input type="date" name="from" defaultValue={params.get('from') || ''} /></label>
      <label>To<input type="date" name="to" defaultValue={params.get('to') || ''} /></label>
      <button type="submit">Search</button><a href="/site-tools/search">Clear filters</a>
    </form>
    {!parsed ? <p role="alert">Use a valid content type, search text of at most 200 characters, and a date range with the start before the end.</p>
      : !route ? <p>No published archive is available for this content type.</p>
      : <><p role="status">{items.length ? `Page ${parsed.page}` : 'No results. Try another search or clear the filters.'}</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>{items.slice(0, 20).map(item => <li key={item.id} style={{ marginBlock: 24 }}>
          <a href={`${route.path === '/' ? '' : route.path}/${encodeURIComponent(item.slug)}`}>{item.title}</a>
          <p><time dateTime={item.publishDate}>{item.publishDate.slice(0, 10)}</time></p>
        </li>)}</ul>
        <nav aria-label="Search result pages" style={{ display: 'flex', gap: 24 }}>
          {parsed.page > 1 && <a href={pageHref(parsed.page - 1)} rel="prev">Previous</a>}
          {items.length > 20 && <a href={pageHref(parsed.page + 1)} rel="next">Next</a>}
        </nav></>}
    <style>{`.eceee-site-search label{display:flex;flex-direction:column;gap:6px}.eceee-site-search input,.eceee-site-search select,.eceee-site-search button{font:inherit;padding:8px;min-height:40px;box-sizing:border-box}.eceee-site-search :focus-visible{outline:2px solid #1464c8;outline-offset:3px}`}</style>
  </main>;
}
