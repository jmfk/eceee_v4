import { imageWidgetMediaItems } from '../../frontend/src/utils/imageWidgetMedia';
import type { DbId, PageReader, PublishedObject, PublishedObjectQuery } from './model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const attribute = (tag: string, name: string) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag)?.[2]?.replaceAll('&amp;', '&');

/** Legacy articles keep their lead photograph in the published body. */
function bodyImage(value: unknown): unknown {
  if (typeof value === 'string') {
    // Media inserts own their ID on the wrapper, rather than the child img.
    const images = /<(?:div|figure)\b[^>]*\bdata-media-id\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<img\b[^>]*>|<img\b[^>]*>/gi;
    for (const match of value.matchAll(images)) {
      const tag = match[0];
      const id = attribute(tag, 'data-media-id');
      if (id) {
        if (uuid.test(id)) return { id, type: 'image' };
        continue; // Never use a stale URL to bypass an invalid media reference.
      }
      const url = attribute(tag, 'src');
      if (url) return { url, altText: attribute(tag, 'alt') || '' };
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (item.type === 'easy_widgets.ImageWidget') {
    const config = item.config as Record<string, unknown> | undefined;
    const image = imageWidgetMediaItems(config).find(candidate => candidate.type === 'image');
    if (image) return image;
  }
  for (const child of Object.values(item)) {
    const image = bodyImage(child);
    if (image) return image;
  }
}

export async function withNewsImages(items: PublishedObject[], reader: PageReader, tenantId: DbId): Promise<PublishedObject[]> {
  const candidates = items.map(item => item.data?.featuredImage || item.data?.featured_image || bodyImage(item.widgets));
  const ids = candidates.flatMap(image => {
    const id = typeof image === 'string' ? image : (image as { id?: string })?.id;
    return id && uuid.test(id) ? [id.toLowerCase()] : [];
  });
  const files = ids.length ? (await reader.publicMedia([...new Set(ids)], [], tenantId)).files : [];
  return items.map((item, index) => {
    const candidate = candidates[index];
    if (!candidate) return item;
    const id = typeof candidate === 'string' ? candidate : (candidate as { id?: string })?.id;
    const image = id && uuid.test(id) ? files.find(file => String(file.id).toLowerCase() === id.toLowerCase()) ?? null : candidate;
    return { ...item, data: { ...item.data, featuredImage: image, featured_image: undefined } };
  });
}

type NewsFlashPage = { limit?: number; offset?: number; priorityId?: DbId | null };

/** Keep the first page's promotion decision while continuing a live feed. */
export async function newsFlashPage(
  reader: PageReader,
  query: Omit<PublishedObjectQuery, 'limit' | 'sortOrder'>,
  tenantId: DbId,
  at: Date,
  page: NewsFlashPage = {},
): Promise<{ items: PublishedObject[]; priorityId: DbId | null }> {
  const limit = Math.min(50, Math.max(1, page.limit ?? 3));
  const offset = Math.max(0, page.offset ?? 0);
  const selection = { ...query, activeTypeOnly: true, sortOrder: '-publish_date' };
  let priority: PublishedObject | undefined;
  let priorityId = page.priorityId ?? null;
  if (!offset) {
    // A newer priority replaces older priorities even after its own expiry.
    const [candidate] = await reader.publishedObjects({ ...selection, offset: 0, newsPriorityOnly: true, limit: 1 }, tenantId, at);
    const until = candidate?.data.newsPriorityUntil;
    const active = candidate?.data.newsPriority === true && (until === undefined || until === null || until === ''
      || (typeof until === 'string' && Number.isFinite(Date.parse(until)) && Date.parse(until) > at.getTime()));
    priority = active ? candidate : undefined;
    priorityId = priority?.id ?? null;
  }
  const lead = priority ? [priority] : [];
  const latest = limit > lead.length ? await reader.publishedObjects({
    ...selection, excludeObjectIds: priorityId ? [priorityId] : [],
    offset: Math.max(0, offset - (priorityId ? 1 : 0)), limit: limit - lead.length,
  }, tenantId, at) : [];
  return { items: await withNewsImages([...lead, ...latest.filter(item => item.id !== priorityId)].slice(0, limit), reader, tenantId), priorityId };
}

export async function newsFlashItems(
  reader: PageReader,
  query: Omit<PublishedObjectQuery, 'limit' | 'sortOrder'>,
  tenantId: DbId,
  at: Date,
  page: NewsFlashPage = {},
): Promise<PublishedObject[]> {
  return (await newsFlashPage(reader, query, tenantId, at, page)).items;
}
