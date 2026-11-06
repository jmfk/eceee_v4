import { describe, expect, it, vi } from 'vitest';
import { newsFlashItems } from '../src/news-flash';
import type { PageReader, PublishedObject } from '../src/model';

const at = new Date('2026-11-06T12:00:00Z');
const story = (id: string, data: Record<string, unknown> = {}) => ({ id, data }) as PublishedObject;
const recent = [story('3'), story('2'), story('1')];
const query = { objectTypeNames: ['article'], classificationIds: ['term'], includeDescendants: true };
const reader = (priority?: PublishedObject) => ({
  publishedObjects: vi.fn(async (q: { newsPriorityOnly?: boolean }) => q.newsPriorityOnly ? (priority ? [priority] : []) : recent),
}) as unknown as PageReader;

describe('News Flash published selection', () => {
  it('uses the latest three when no story is prioritized', async () => {
    expect(await newsFlashItems(reader(), query, 'tenant-7', at)).toEqual(recent);
  });

  it('finds an older priority independently of the latest-three window', async () => {
    const db = reader(story('old-priority', { newsPriority: true }));
    expect((await newsFlashItems(db, query, 'tenant-7', at)).map(item => item.id)).toEqual(['old-priority', '3', '2']);
    expect(db.publishedObjects).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ ...query, newsPriorityOnly: true, limit: 1, sortOrder: '-publish_date', activeTypeOnly: true }), 'tenant-7', at);
  });

  it('does not duplicate a priority already in the latest three', async () => {
    expect((await newsFlashItems(reader(story('2', { newsPriority: true })), query, 'tenant-7', at)).map(item => item.id)).toEqual(['2', '3', '1']);
  });

  it.each(['2026-11-06T11:59:59Z', '2026-11-06T12:00:00Z', 'invalid', false])('expires or rejects an invalid expiry %s without reviving older priorities', async until => {
    const db = reader(story('newest-priority', { newsPriority: true, newsPriorityUntil: until }));
    expect(await newsFlashItems(db, query, 'tenant-7', at)).toEqual(recent);
    expect(db.publishedObjects).toHaveBeenCalledTimes(2);
  });

  it('honors an expiry with an explicit timezone', async () => {
    const priority = story('priority', { newsPriority: true, newsPriorityUntil: '2026-11-06T14:00:00+01:00' });
    expect((await newsFlashItems(reader(priority), query, 'tenant-7', at))[0]).toEqual(priority);
  });
});
