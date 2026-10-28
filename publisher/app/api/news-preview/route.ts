import { database } from '@/src/db';
import { contentHostname } from '../../../src/hostname';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};
const validId = (value: string) => /^\d{1,19}$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n;
const validType = (value: string) => /^[a-z0-9_-]{1,100}$/i.test(value);
const validClassification = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteId = params.get('siteId') || '';
  const types = params.getAll('type');
  const classifications = params.getAll('classificationId');
  const limit = Number(params.get('limit'));
  if (!validId(siteId) || !types.length || types.length > 20 || types.some(type => !validType(type))
      || classifications.length > 20 || classifications.some(id => !validClassification(id))
      || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return Response.json({ error: 'Invalid news query.' }, { status: 400, headers: responseHeaders });
  }

  const hostname = contentHostname(request.headers.get('host') || '');
  try {
    const items = await database.withSnapshot(async reader => {
      const root = await reader.root(hostname);
      if (!root || root.id !== siteId) return null;
      const at = new Date();
      if (!await reader.version(root.id, at)) return null;
      return reader.publishedObjects({
        objectTypeIds: types.filter(type => /^\d+$/.test(type)),
        objectTypeNames: types.filter(type => !/^\d+$/.test(type)),
        classificationIds: classifications,
        includeDescendants: params.get('includeDescendants') !== 'false',
        featuredOnly: params.get('featuredOnly') === 'true',
        activeTypeOnly: true,
        limit,
        sortOrder: '-publish_date',
      }, root.tenant_id, at);
    });
    if (!items) return Response.json({ error: 'Site not found.' }, { status: 404, headers: responseHeaders });
    return Response.json({ items: items.map(({ id, slug, title, objectType, data, publishDate, isFeatured }) => ({
      id, slug, title, objectType, data, publishDate, isFeatured,
    })) }, { headers: responseHeaders });
  } catch (error) {
    console.error('[news-preview] query failed', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'News are temporarily unavailable.' }, { status: 503, headers: responseHeaders });
  }
}
