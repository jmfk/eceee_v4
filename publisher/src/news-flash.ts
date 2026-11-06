import type { DbId, PageReader, PublishedObject, PublishedObjectQuery } from './model';

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
  return { items: [...lead, ...latest.filter(item => item.id !== priorityId)].slice(0, limit), priorityId };
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
