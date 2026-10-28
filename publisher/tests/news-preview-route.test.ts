import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  root: vi.fn(),
  version: vi.fn(),
  publishedObjects: vi.fn(),
}));
vi.mock('@/src/db', () => ({ database: { withSnapshot: async (read: (reader: unknown) => Promise<unknown>) => read(mocks) } }));

import { GET } from '../app/api/news-preview/route';

const request = (query: string, host = 'eceee.localhost:11615') => new Request(
  `http://${host}/api/news-preview?${query}`,
  { headers: { host } },
);

describe('public news preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.root.mockResolvedValue({ id: '85', tenant_id: 'tenant-a' });
    mocks.version.mockResolvedValue({ id: '263' });
    mocks.publishedObjects.mockResolvedValue([
      { id: '10', slug: 'story', title: 'Story', objectType: { id: '9', name: 'article' },
        data: { summary: 'Published story' }, publishDate: '2026-10-28T12:00:00Z', isFeatured: true,
        widgets: { internal: true }, metadata: { internal: true } },
    ]);
  });

  it('filters and limits within the host tenant before returning public news fields', async () => {
    const term = '11111111-1111-4111-8111-111111111111';
    const response = await GET(request(`siteId=85&type=9&type=article&classificationId=${term}&featuredOnly=true&limit=3`));

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(mocks.root).toHaveBeenCalledWith('eceee.localhost');
    expect(mocks.publishedObjects).toHaveBeenCalledWith({
      objectTypeIds: ['9'], objectTypeNames: ['article'], classificationIds: [term],
      includeDescendants: true, featuredOnly: true, activeTypeOnly: true,
      limit: 3, sortOrder: '-publish_date',
    }, 'tenant-a', expect.any(Date));
    expect(await response.json()).toEqual({ items: [{
      id: '10', slug: 'story', title: 'Story', objectType: { id: '9', name: 'article' },
      data: { summary: 'Published story' }, publishDate: '2026-10-28T12:00:00Z', isFeatured: true,
    }] });
  });

  it('denies a mismatched or unpublished site before querying news', async () => {
    expect((await GET(request('siteId=86&type=news&limit=2'))).status).toBe(404);
    mocks.version.mockResolvedValue(null);
    expect((await GET(request('siteId=85&type=news&limit=2'))).status).toBe(404);
    expect(mocks.publishedObjects).not.toHaveBeenCalled();
  });

  it('rejects oversized and malformed queries without touching the database', async () => {
    expect((await GET(request('siteId=85&type=news&limit=51'))).status).toBe(400);
    expect((await GET(request('siteId=85&type=bad%2Ftype&limit=2'))).status).toBe(400);
    expect((await GET(request('siteId=85&type=news&classificationId=invalid&limit=2'))).status).toBe(400);
    expect(mocks.root).not.toHaveBeenCalled();
  });
});
