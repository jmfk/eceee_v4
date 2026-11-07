import { describe, expect, it, vi } from 'vitest';
import type { PageReader } from '../src/model';
import { relatedNewsItems, selectedNewsArticle } from '../src/related-news';

const at = new Date('2026-11-07T12:00:00Z');
const types = { objectTypeIds: ['8'] };
describe('related published articles', () => {
  it('uses the selected slug, shared tags and requested kind before limiting', async () => {
    const publishedObjects = vi.fn().mockResolvedValueOnce([{ id: '1', relatedTagIds: ['tag'] }]).mockResolvedValueOnce([{ id: '2' }]);
    const reader = { publishedObjects } as unknown as PageReader;
    expect(await relatedNewsItems(reader, types, 'tenant', at, 'selected', 'column', 5)).toEqual([{ id: '2' }]);
    expect(publishedObjects).toHaveBeenNthCalledWith(1, expect.objectContaining({ slug: 'selected', limit: 1 }), 'tenant', at);
    expect(publishedObjects).toHaveBeenNthCalledWith(2, { ...types, relatedTagIds: ['tag'], excludeObjectIds: ['1'], articleKind: 'column', activeTypeOnly: true, sortOrder: '-publish_date', limit: 5 }, 'tenant', at);
  });
  it('does not substitute unrelated latest news when no shared tags exist', async () => {
    const publishedObjects = vi.fn().mockResolvedValue([{ id: '1', relatedTagIds: [] }]);
    expect(await relatedNewsItems({ publishedObjects } as unknown as PageReader, types, 'tenant', at, 'selected', 'news', 5)).toEqual([]);
    expect(publishedObjects).toHaveBeenCalledTimes(1);
  });
  it('uses the priority article on the news landing page', async () => {
    const publishedObjects = vi.fn().mockResolvedValueOnce([{ id: '1', data: { newsPriority: true } }]);
    expect((await selectedNewsArticle({ publishedObjects } as unknown as PageReader, types, 'tenant', at))?.id).toBe('1');
    expect(publishedObjects).toHaveBeenCalledWith(expect.objectContaining({ newsPriorityOnly: true }), 'tenant', at);
  });
});
