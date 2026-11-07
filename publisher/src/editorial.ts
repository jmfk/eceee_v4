import { publishedObjectWidgets } from './model';
import type { DbId, PageReader, PublishedObject, PublishedObjectQuery } from './model';
import { withNewsImages } from './news-flash';

export type EditorialKind = 'columnists' | 'events';
export type EventGroup = 'all' | 'eceee' | 'other';
export const editorialKind = (config: Record<string, unknown>): EditorialKind | null => {
  const template = config.displayTemplate ?? config.display_template;
  return template === 'columnists' || template === 'events' ? template : null;
};

/** Never serialize raw media references or arbitrary stored object fields. */
export function editorialPublicData(item: PublishedObject, kind: EditorialKind, detail = false): Record<string, unknown> {
  const data = item.data;
  const image = data.featuredImage as { id?: unknown } | undefined;
  const validReference = image && typeof image === 'object'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(image.id));
  const result: Record<string, unknown> = { featuredImage: validReference ? data.featuredImage ?? null : null };
  const fields = kind === 'columnists'
    ? [['affiliation'], ['prefix'], ['homePage', 'home_page']]
    : [['eventStartDate', 'event_start_date'], ['eventEndDate', 'event_end_date'],
      ...(detail ? [['eventTime', 'event_time'], ['organiser'], ['venue'], ['focusAreas', 'focus_areas'], ['externalUrl', 'external_url']] : [])];
  for (const [key, alias] of fields) {
    const candidate = data[key] ?? (alias ? data[alias] : undefined);
    if (typeof candidate === 'string') result[key] = candidate;
  }
  if (kind === 'columnists' && data.latestColumn && typeof data.latestColumn === 'object') {
    const column = data.latestColumn as Record<string, unknown>;
    if (typeof column.title === 'string' && typeof column.slug === 'string') {
      result.latestColumn = { title: column.title, slug: column.slug, publishDate: column.publishDate };
    }
  }
  return result;
}

export async function withLatestColumn(item: PublishedObject, reader: PageReader, tenantId: DbId, at: Date): Promise<PublishedObject> {
  if (!/^\d+$/.test(String(item.id))) return item;
  // One bounded lookup per displayed profile; never cap a mixed-author feed before grouping.
  const [latest] = await reader.publishedObjects({ objectTypeNames: ['article'], articleKind: 'column',
    authorId: String(item.id), limit: 1, sortOrder: '-publish_date', activeTypeOnly: true }, tenantId, at);
  return { ...item, data: { ...item.data, latestColumn: latest
    ? { title: latest.title, slug: latest.slug, publishDate: latest.publishDate } : null } };
}

export async function editorialItems(reader: PageReader, kind: EditorialKind, tenantId: DbId, at: Date,
  options: { limit: number; offset?: number; eventGroup?: EventGroup; slug?: string; detail?: boolean } ): Promise<PublishedObject[]> {
  const query: PublishedObjectQuery = { objectTypeNames: [kind === 'columnists' ? 'columnist' : 'event'],
    activeTypeOnly: true, limit: options.limit, offset: options.offset, slug: options.slug,
    sortOrder: kind === 'columnists' ? 'title' : '-publish_date',
    ...(kind === 'events' ? { eventGroup: options.eventGroup ?? 'all' } : {}) };
  const items = (await reader.publishedObjects(query, tenantId, at)).map(item => ({
    ...item, widgets: publishedObjectWidgets(item.widgets, at),
  }));
  const images = await withNewsImages(items.map(item => kind === 'columnists'
    ? { ...item, data: { ...item.data, featuredImage: item.data.photo || item.data.photoUrl || item.data.photo_url } } : item), reader, tenantId);
  const enriched = kind === 'columnists' ? await Promise.all(images.map(item => withLatestColumn(item, reader, tenantId, at))) : images;
  return enriched.map(item => ({ ...item, metadata: {}, widgets: options.detail ? item.widgets : {},
    data: editorialPublicData(item, kind, options.detail) }));
}

export async function columnistId(reader: PageReader, tenantId: DbId, at: Date, slug: string): Promise<DbId | null> {
  const [author] = await reader.publishedObjects({ objectTypeNames: ['columnist'], slug,
    activeTypeOnly: true, limit: 1, sortOrder: 'title' }, tenantId, at);
  return author?.id ?? null;
}
