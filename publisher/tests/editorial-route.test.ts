import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ root: vi.fn(), version: vi.fn(), publishedObjects: vi.fn(), publicMedia: vi.fn(), publishedPageReferences: vi.fn(), defaultTheme: vi.fn() }));
vi.mock('@/src/db', () => ({ database: { withSnapshot: async (read: (reader: unknown) => Promise<unknown>) => read(mocks) } }));
import { GET } from '../app/api/editorial/route';
const request = (query: string) => new Request(`http://eceee.localhost:11615/api/editorial?${query}`, { headers: { host: 'eceee.localhost:11615' } });
describe('public editorial endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicMedia.mockResolvedValue({ files: [], collections: {} });
    mocks.publishedPageReferences.mockResolvedValue([]);
    mocks.defaultTheme.mockResolvedValue(null);
    mocks.root.mockResolvedValue({ id: '249', tenant_id: 'tenant' });
    mocks.version.mockResolvedValue({ id: 'published' });
    mocks.publishedObjects.mockResolvedValue([{ id: '9', title: 'Event', slug: 'event', data: { venue: 'Online' }, widgets: { main: [] }, metadata: { internal: true } }]);
  });
  it('binds requests to the published host site and returns only list fields', async () => {
    const response = await GET(request('siteId=249&kind=events&eventGroup=other&limit=12&offset=12'));
    expect(response.status).toBe(200);
    expect(mocks.publishedObjects).toHaveBeenCalledWith(expect.objectContaining({ eventGroup: 'other', offset: 12, limit: 12, activeTypeOnly: true }), 'tenant', expect.any(Date));
    const item = (await response.json()).items[0];
    expect(item).not.toHaveProperty('widgets'); expect(item).not.toHaveProperty('metadata');
  });
  it('returns a selected event published body on detail requests', async () => {
    const response = await GET(request('siteId=249&kind=events&slug=event&detail=true'));
    expect((await response.json()).items[0].widgets).toEqual({ main: [] });
    expect(mocks.publishedObjects).toHaveBeenCalledWith(expect.objectContaining({ slug: 'event', eventGroup: 'all', limit: 1 }), 'tenant', expect.any(Date));
  });
  it('includes published object theme definitions with pinned detail widgets', async () => {
    const definitions = { version: 1, items: [{ id: 'profile-card', active_version: 1, releases: [{ version: 1, template: '<p>{{name}}</p>' }] }] };
    mocks.defaultTheme.mockResolvedValue({ widget_types: definitions });
    mocks.publishedObjects.mockResolvedValue([{ id: '9', title: 'Event', slug: 'event', data: {}, widgets: { main: [
      { id: 'card', type: 'theme_widgets.profile-card', type_version: 1, config: { name: 'Published content' } },
    ] } }]);
    const response = await GET(request('siteId=249&kind=events&slug=event&detail=true'));
    const item = (await response.json()).items[0];
    expect(item.themeWidgetTypes).toEqual(definitions);
    expect(item.widgets.main[0]).toMatchObject({ type: 'theme_widgets.profile-card', typeVersion: 1 });
  });

  it('excludes hidden, unpublished, future and expired widgets including nested content', async () => {
    const widget = (content: string, flags = {}) => ({ type: 'easy_widgets.ContentWidget', config: { content }, ...flags });
    mocks.publishedObjects.mockResolvedValue([{ id: '9', title: 'Event', slug: 'event', data: { internalNotes: 'PRIVATE' }, widgets: { main: [
      widget('Visible content'), widget('HIDDEN', { is_visible: false }), widget('UNPUBLISHED', { isPublished: false }),
      widget('FUTURE', { publishEffectiveDate: '2999-01-01' }), widget('EXPIRED', { publish_expire_date: '2000-01-01' }),
      { type: 'easy_widgets.SectionWidget', config: { slots: { main: [widget('NESTED SECRET', { isVisible: false }), widget('Nested public')] } } },
    ] } }]);
    const response = await GET(request('siteId=249&kind=events&slug=event&detail=true'));
    const json = JSON.stringify(await response.json());
    expect(json).toContain('Visible content'); expect(json).toContain('Nested public');
    for (const secret of ['PRIVATE', 'HIDDEN', 'UNPUBLISHED', 'FUTURE', 'EXPIRED', 'NESTED SECRET']) expect(json).not.toContain(secret);
  });

  it('rejects invalid queries and mismatched/unpublished sites before reading objects', async () => {
    for (const query of ['siteId=249&kind=article', 'siteId=249&kind=events&offset=-1', 'siteId=249&kind=events&limit=51', 'siteId=249&kind=events&detail=true']) expect((await GET(request(query))).status).toBe(400);
    expect((await GET(request('siteId=250&kind=events'))).status).toBe(404);
    mocks.version.mockResolvedValue(null);
    expect((await GET(request('siteId=249&kind=events'))).status).toBe(404);
    expect(mocks.publishedObjects).not.toHaveBeenCalled();
  });
});
