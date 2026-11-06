import type { DbId, PageReader, PublishedObject, PublishedObjectQuery } from './model';

/** A newer priority replaces older priorities even after its own expiry. */
export async function newsFlashItems(
  reader: PageReader,
  query: Omit<PublishedObjectQuery, 'limit' | 'sortOrder'>,
  tenantId: DbId,
  at: Date,
): Promise<PublishedObject[]> {
  const selection = { ...query, activeTypeOnly: true, sortOrder: '-publish_date' };
  const latest = await reader.publishedObjects({ ...selection, limit: 3 }, tenantId, at);
  const [priority] = await reader.publishedObjects({ ...selection, newsPriorityOnly: true, limit: 1 }, tenantId, at);
  if (!priority || priority.data.newsPriority !== true) return latest.slice(0, 3);
  const until = priority.data.newsPriorityUntil;
  // Invalid expiry data fails closed; an empty date means no scheduled expiry.
  const active = until === undefined || until === null || until === ''
    || (typeof until === 'string' && Number.isFinite(Date.parse(until)) && Date.parse(until) > at.getTime());
  return active ? [priority, ...latest.filter(item => item.id !== priority.id)].slice(0, 3) : latest.slice(0, 3);
}
