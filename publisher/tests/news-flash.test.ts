import { describe, expect, it, vi } from 'vitest';
import { newsFlashItems, newsFlashPage } from '../src/news-flash';
import type { PageReader, PublishedObject, PublicMediaItem } from '../src/model';

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
    expect(db.publishedObjects).toHaveBeenNthCalledWith(1,
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

  it('pages through every story exactly once when the priority is outside the first ordinary batch', async () => {
    const all = Array.from({ length: 30 }, (_, index) => story(String(30 - index)));
    const priority = story('5', { newsPriority: true });
    const db = { publishedObjects: vi.fn(async (q: { newsPriorityOnly?: boolean; excludeObjectIds?: string[]; offset?: number; limit: number }) => {
      if (q.newsPriorityOnly) return [priority];
      return all.filter(item => !q.excludeObjectIds?.includes(item.id)).slice(q.offset || 0, (q.offset || 0) + q.limit);
    }) } as unknown as PageReader;
    const pages = [];
    for (const offset of [0, 12, 24]) pages.push(...await newsFlashItems(db, query, 'tenant-7', at, { offset, limit: 12, priorityId: offset ? '5' : undefined }));
    expect(pages[0]).toEqual(priority);
    expect(pages).toHaveLength(30);
    expect(new Set(pages.map(item => item.id)).size).toBe(30);
  });

  it('excludes the promoted story before applying the offset on subsequent batches', async () => {
    const db = reader(story('99', { newsPriority: true }));
    await newsFlashItems(db, query, 'tenant-7', at, { offset: 12, limit: 12, priorityId: '99' });
    expect(db.publishedObjects).toHaveBeenLastCalledWith(expect.objectContaining({
      excludeObjectIds: ['99'], offset: 11, limit: 12,
    }), 'tenant-7', at);
  });

  it('does not skip a regular story if priority expires between pages', async () => {
    const all = Array.from({ length: 24 }, (_, index) => story(String(24 - index)));
    const priority = story('99', { newsPriority: true, newsPriorityUntil: '2026-11-06T12:00:01Z' });
    const db = { publishedObjects: vi.fn(async (q: { newsPriorityOnly?: boolean; excludeObjectIds?: string[]; offset?: number; limit: number }) => {
      if (q.newsPriorityOnly) return [priority];
      return all.filter(item => !q.excludeObjectIds?.includes(item.id)).slice(q.offset || 0, (q.offset || 0) + q.limit);
    }) } as unknown as PageReader;
    const first = await newsFlashPage(db, query, 'tenant-7', at, { limit: 12 });
    const next = await newsFlashPage(db, query, 'tenant-7', new Date('2026-11-06T12:00:02Z'), { limit: 12, offset: 12, priorityId: first.priorityId });
    expect(first.items.map(item => item.id)).toEqual(['99', ...all.slice(0, 11).map(item => item.id)]);
    expect(next.items.map(item => item.id)).toEqual(all.slice(11, 23).map(item => item.id));
    expect(db.publishedObjects).toHaveBeenCalledTimes(3);
  });

  it('honors an expiry with an explicit timezone', async () => {
    const priority = story('priority', { newsPriority: true, newsPriorityUntil: '2026-11-06T14:00:00+01:00' });
    expect((await newsFlashItems(reader(priority), query, 'tenant-7', at))[0]).toEqual(priority);
  });
});


describe('News Flash real article images', () => {
  it('uses the first published body image without exposing the body in the feed', async () => {
    const article = { ...story('7'), widgets: { main: [{ type: 'easy_widgets.ContentWidget', config: {
      content: '<p>Article</p><img src="https://media.example.org/photo.jpg?a=1&amp;b=2" alt="Photograph">',
    } }] } };
    const db = { publishedObjects: vi.fn(async q => q.newsPriorityOnly ? [] : [article]) } as unknown as PageReader;
    const result = await newsFlashItems(db, query, 'tenant-7', at);
    expect(result[0].data.featuredImage).toEqual({ url: 'https://media.example.org/photo.jpg?a=1&b=2', altText: 'Photograph' });
    expect(article.data.featuredImage).toBeUndefined();
  });

  it('prefers an explicit featured image over an embedded image', async () => {
    const article = { ...story('7', { featuredImage: { url: 'https://media.example.org/featured.jpg' } }),
      widgets: { main: [{ config: { content: '<img src="https://media.example.org/body.jpg">' } }] } };
    const db = { publishedObjects: vi.fn(async q => q.newsPriorityOnly ? [] : [article]) } as unknown as PageReader;
    expect((await newsFlashItems(db, query, 'tenant-7', at))[0].data.featuredImage).toEqual(article.data.featuredImage);
  });

  it.each(['div', 'figure'])('validates the media ID on an embedded %s before using a saved URL', async tag => {
    const id = '233960cb-1e17-4583-a65f-e6430be98bb6';
    const article = { ...story('7'), widgets: { main: [{ config: { content: `<${tag} data-media-id="${id}"><img src="https://stale.example/private.jpg"></${tag}>` } }] } };
    const db = { publishedObjects: vi.fn(async q => q.newsPriorityOnly ? [] : [article]), publicMedia: vi.fn(async () => ({ files: [], collections: {} })) } as unknown as PageReader;
    expect((await newsFlashItems(db, query, 'tenant-7', at))[0].data.featuredImage).toBeNull();
    expect(db.publicMedia).toHaveBeenCalledExactlyOnceWith([id], [], 'tenant-7');
  });

  it.each([
    { image: { url: 'https://media.example/photo.jpg', type: 'image' } },
    { imageUrl: 'https://media.example/photo.jpg' },
    { image_url: 'https://media.example/photo.jpg' },
  ])('uses the existing Image widget configuration contract: %j', async config => {
    const article = { ...story('7'), widgets: { main: [{ type: 'easy_widgets.ImageWidget', config }] } };
    const db = { publishedObjects: vi.fn(async q => q.newsPriorityOnly ? [] : [article]) } as unknown as PageReader;
    expect((await newsFlashItems(db, query, 'tenant-7', at))[0].data.featuredImage).toMatchObject({ url: 'https://media.example/photo.jpg' });
  });

  it('finds a valid image after an image tag without a source', async () => {
    const article = { ...story('7'), widgets: { main: [{ config: { content: '<img alt="empty"><img src="https://media.example/photo.jpg">' } }] } };
    const db = { publishedObjects: vi.fn(async q => q.newsPriorityOnly ? [] : [article]) } as unknown as PageReader;
    expect((await newsFlashItems(db, query, 'tenant-7', at))[0].data.featuredImage).toMatchObject({ url: 'https://media.example/photo.jpg' });
  });

  it('resolves media IDs only through the current tenant public media lookup', async () => {
    const id = '233960cb-1e17-4583-a65f-e6430be98bb6';
    const article = { ...story('7'), widgets: { main: [{ config: { content: `<img data-media-id="${id}" src="https://stale.example/private.jpg">` } }] } };
    const db = { publishedObjects: vi.fn(async q => q.newsPriorityOnly ? [] : [article]), publicMedia: vi.fn(async () => ({ files: [], collections: {} })) } as unknown as PageReader;
    expect((await newsFlashItems(db, query, 'tenant-7', at))[0].data.featuredImage).toBeNull();
    expect(db.publicMedia).toHaveBeenCalledExactlyOnceWith([id], [], 'tenant-7');
    vi.mocked(db.publicMedia).mockResolvedValue({ files: [{ id, type: 'image', url: 'https://public.example/image.jpg', width: 400, height: 800, focalPoint: { x: 0.2, y: 0.9 } } as PublicMediaItem], collections: {} });
    expect((await newsFlashItems(db, query, 'tenant-7', at))[0].data.featuredImage).toMatchObject({ url: 'https://public.example/image.jpg', width: 400, height: 800, focalPoint: { x: 0.2, y: 0.9 } });
  });
});
