import type { DbId, PageReader, PublishedObject, PublishedObjectQuery } from './model';

/** A newer priority replaces older priorities even after its own expiry. */
export async function newsFlashItems(
  reader: PageReader,
  query: Omit<PublishedObjectQuery, 'limit' | 'sortOrder'>,
  tenantId: DbId,
  at: Date,
  page: { limit?: number; offset?: number } = {},
): Promise<PublishedObject[]> {
  const limit = Math.min(50, Math.max(1, page.limit ?? 3));
  const offset = Math.max(0, page.offset ?? 0);
  const selection = { ...query, activeTypeOnly: true, sortOrder: '-publish_date' };
  const [candidate] = await reader.publishedObjects({ ...selection, offset: 0, newsPriorityOnly: true, limit: 1 }, tenantId, at);
  const until = candidate?.data.newsPriorityUntil;
  const active = candidate?.data.newsPriority === true && (until === undefined || until === null || until === ''
    || (typeof until === 'string' && Number.isFinite(Date.parse(until)) && Date.parse(until) > at.getTime()));
  const priority = active ? candidate : undefined;
  const lead = priority && offset === 0 ? [priority] : [];
  const latest = limit > lead.length ? await reader.publishedObjects({
    ...selection, excludeObjectIds: priority ? [priority.id] : [],
    offset: Math.max(0, offset - (priority ? 1 : 0)), limit: limit - lead.length,
  }, tenantId, at) : [];
  return [...lead, ...latest.filter(item => item.id !== priority?.id)].slice(0, limit);
}
