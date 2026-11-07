import { prepareEditorialWidgets } from '../../../src/model';
import { database } from '@/src/db';
import { contentHostname } from '../../../src/hostname';
import { editorialItems, type EditorialKind, type EventGroup } from '../../../src/editorial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteId = params.get('siteId') || '';
  const kind = params.get('kind') || '';
  const group = params.get('eventGroup') || 'all';
  const limit = Number(params.get('limit') || 12);
  const offset = Number(params.get('offset') || 0);
  const slug = params.get('slug') || undefined;
  const detail = params.get('detail') === 'true';
  if (!/^\d{1,19}$/.test(siteId) || BigInt(siteId) > 9_223_372_036_854_775_807n
      || !['columnists', 'events'].includes(kind) || !['all', 'eceee', 'other'].includes(group)
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 50
      || !Number.isSafeInteger(offset) || offset < 0 || (detail && !slug)
      || (slug !== undefined && !/^[\p{L}\p{N}_.-]{1,200}$/u.test(slug))) {
    return Response.json({ error: 'Invalid directory query.' }, { status: 400, headers });
  }
  try {
    const result = await database.withSnapshot(async reader => {
      const root = await reader.root(contentHostname(request.headers.get('host') || ''));
      if (!root || root.id !== siteId) return null;
      const at = new Date();
      const version = await reader.version(root.id, at);
      if (!version) return null;
      const items = await editorialItems(reader, kind as EditorialKind, root.tenant_id, at,
        { limit: detail ? 1 : limit, offset: detail ? 0 : offset, eventGroup: detail ? 'all' : group as EventGroup, slug, detail });
      const preparedBody = detail && items[0] ? await prepareEditorialWidgets(reader, root, version, items[0].widgets, at) : undefined;
      return { items: items.map(({ id, slug, title, objectType, data, publishDate }) => ({
        id, slug, title, objectType, data, publishDate, ...(detail ? preparedBody : {}),
      })) };
    });
    return result ? Response.json(result, { headers }) : Response.json({ error: 'Site not found.' }, { status: 404, headers });
  } catch (error) {
    console.error('[editorial] query failed', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Content is temporarily unavailable.' }, { status: 503, headers });
  }
}
