import type { DbId, PageReader, PublishedObject, PublishedObjectQuery } from './model';
import { newsFlashItems, withNewsImages } from './news-flash';

type NewsTypes = Pick<PublishedObjectQuery, 'objectTypeIds' | 'objectTypeNames'>;
export const newsArticleKind = (value: unknown): 'all' | 'news' | 'column' => value === 'news' || value === 'column' ? value : 'all';

export async function selectedNewsArticle(reader: PageReader, types: NewsTypes, tenantId: DbId, at: Date, slug?: string): Promise<PublishedObject | undefined> {
  const items = slug
    ? await reader.publishedObjects({ ...types, slug, limit: 1, sortOrder: '-publish_date', activeTypeOnly: true }, tenantId, at)
    : await newsFlashItems(reader, types, tenantId, at, { limit: 1 });
  return items[0];
}

export async function relatedNewsItems(reader: PageReader, types: NewsTypes, tenantId: DbId, at: Date,
  slug: string | undefined, kind: 'all' | 'news' | 'column', limit: number): Promise<PublishedObject[]> {
  const current = await selectedNewsArticle(reader, types, tenantId, at, slug);
  if (!current?.relatedTagIds?.length) return [];
  return withNewsImages(await reader.publishedObjects({ ...types, relatedTagIds: current.relatedTagIds, excludeObjectIds: [current.id],
    articleKind: kind, activeTypeOnly: true, sortOrder: '-publish_date', limit }, tenantId, at), reader, tenantId);
}
