import { columnistId } from '../../../src/editorial';
import { database } from '@/src/db';
import { newsFlashPage, withNewsImages } from '../../../src/news-flash';
import { newsArticleKind, relatedNewsItems, selectedNewsArticle } from '../../../src/related-news';
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
  const offset = Number(params.get('offset') || 0);
  const flash = params.get('newsFlash') === 'true';
  const priorityId = params.get('priorityId');
  const related = params.get('related') === 'true';
  const latestArticle = params.get('latestArticle') === 'true';
  const slug = params.get('slug') || undefined;
  const authorSlug = params.get('columnist');
  const kind = params.get('articleKind') || 'all';
  if (!validId(siteId) || !types.length || types.length > 20 || types.some(type => !validType(type))
      || classifications.length > 20 || classifications.some(id => !validClassification(id))
      || !Number.isSafeInteger(offset) || offset < 0
      || (flash && offset > 0 && (priorityId === null || (priorityId !== 'none' && !validId(priorityId))))
      || !Number.isInteger(limit) || limit < 1 || limit > 50
      || !['all', 'news', 'column'].includes(kind)
      || (authorSlug !== null && !/^[\p{L}\p{N}_.-]{1,200}$/u.test(authorSlug))
      || (slug !== undefined && !/^[\p{L}\p{N}_.-]{1,200}$/u.test(slug))) {
    return Response.json({ error: 'Invalid news query.' }, { status: 400, headers: responseHeaders });
  }

  const hostname = contentHostname(request.headers.get('host') || '');
  try {
    const page = await database.withSnapshot(async reader => {
      const root = await reader.root(hostname);
      if (!root || root.id !== siteId) return null;
      const at = new Date();
      if (!await reader.version(root.id, at)) return null;
      const authorId = authorSlug ? await columnistId(reader, root.tenant_id, at, authorSlug) : null;
      if (authorSlug && !authorId) return { items: [], priorityId: null };
      const query = {
        ...(authorId ? { authorId, articleKind: 'column' as const } : {}),
        objectTypeIds: types.filter(type => /^\d+$/.test(type)),
        objectTypeNames: types.filter(type => !/^\d+$/.test(type)),
        classificationIds: classifications,
        includeDescendants: params.get('includeDescendants') !== 'false',
        featuredOnly: params.get('featuredOnly') === 'true',
        activeTypeOnly: true,
        ...(!authorId && kind !== 'all' ? { articleKind: newsArticleKind(kind) } : {}),
        limit,
        sortOrder: '-publish_date',
      };
      const articleTypes = { objectTypeIds: query.objectTypeIds, objectTypeNames: query.objectTypeNames };
      if (related) return { items: await withNewsImages(await relatedNewsItems(reader, articleTypes, root.tenant_id, at, slug, newsArticleKind(kind), limit), reader, root.tenant_id) };
      if (latestArticle) {
        const item = await selectedNewsArticle(reader, articleTypes, root.tenant_id, at, slug);
        return { items: item ? [item] : [] };
      }
      return flash
        ? newsFlashPage(reader, query, root.tenant_id, at, { limit, offset, priorityId: priorityId === 'none' ? null : priorityId })
        : { items: await withNewsImages(await reader.publishedObjects(query, root.tenant_id, at), reader, root.tenant_id) };
    });
    if (!page) return Response.json({ error: 'Site not found.' }, { status: 404, headers: responseHeaders });
    return Response.json({ ...(flash ? { priorityId: 'priorityId' in page ? page.priorityId : null } : {}), items: page.items.map(({ id, slug, title, objectType, data, publishDate, isFeatured }) => ({
      id, slug, title, objectType, data, publishDate, isFeatured,
    })) }, { headers: responseHeaders });
  } catch (error) {
    console.error('[news-preview] query failed', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'News are temporarily unavailable.' }, { status: 503, headers: responseHeaders });
  }
}
