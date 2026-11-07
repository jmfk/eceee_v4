import { describe, expect, it, vi } from 'vitest';
import { editorialItems, columnistId } from '../src/editorial';
import type { PageReader } from '../src/model';

describe('published editorial directories', () => {
  it('returns profile metadata, latest published column and public portrait without rewriting source', async () => {
    const source = { id: '9', title: 'Jane', data: { photo: '11111111-1111-4111-8111-111111111111',
      affiliation: 'Institute', prefix: 'Researcher', homePage: 'https://example.org', internalNotes: 'PRIVATE' },
      widgets: { main: [{ type: 'easy_widgets.ContentWidget', config: { content: '<h1>Jane</h1><p>Biography</p>' } }] } };
    const latest = { id: '22', title: 'Latest column', slug: 'latest', publishDate: '2026-11-07', data: { secret: 'PRIVATE' } };
    const reader = { publishedObjects: vi.fn().mockImplementation(query => query.authorId ? [latest] : [source]),
      publicMedia: vi.fn().mockResolvedValue({ files: [{ id: source.data.photo, url: '/portrait.jpg' }] }) } as unknown as PageReader;
    const items = await editorialItems(reader, 'columnists', 'tenant', new Date(0), { limit: 12, offset: 12 });
    expect(reader.publishedObjects).toHaveBeenCalledWith(expect.objectContaining({ objectTypeNames: ['columnist'], activeTypeOnly: true, sortOrder: 'title', offset: 12 }), 'tenant', new Date(0));
    expect(reader.publishedObjects).toHaveBeenLastCalledWith(expect.objectContaining({ authorId: '9', articleKind: 'column', limit: 1, sortOrder: '-publish_date', activeTypeOnly: true }), 'tenant', new Date(0));
    expect(items[0].data).toEqual({ affiliation: 'Institute', prefix: 'Researcher', homePage: 'https://example.org',
      featuredImage: { id: source.data.photo, url: '/portrait.jpg' }, latestColumn: { title: latest.title, slug: 'latest', publishDate: latest.publishDate } });
    expect(items[0].widgets).toEqual({});
    expect(JSON.stringify(items)).not.toContain('PRIVATE');
    expect(source.data.photo).toBe('11111111-1111-4111-8111-111111111111');
    expect(source.widgets.main[0].config.content).toContain('Biography');
  });
  it('omits rejected private media references and unrelated fields from public items', async () => {
    const reader = { publishedObjects: vi.fn().mockResolvedValue([{ data: { photo: { id: '11111111-1111-4111-8111-111111111111', url: '/private.jpg' }, secret: 'PRIVATE' }, widgets: {} }]),
      publicMedia: vi.fn().mockResolvedValue({ files: [] }) } as unknown as PageReader;
    const items = await editorialItems(reader, 'columnists', 'tenant', new Date(0), { limit: 12 });
    expect(items[0].data).toEqual({ featuredImage: null });
    expect(JSON.stringify(items)).not.toContain('/private.jpg');
    expect(JSON.stringify(items)).not.toContain('PRIVATE');
  });
  it.each(['columnists', 'events'] as const)('rejects raw URL-only media in %s even when a published body uses it', async kind => {
    const reader = { publishedObjects: vi.fn().mockResolvedValue([{ data: { photo: { url: '/private.jpg' } }, widgets: { main: [
      { type: 'easy_widgets.ContentWidget', config: { content: '<img src="https://example.org/unverified.jpg">' } },
    ] } }]) } as unknown as PageReader;
    const items = await editorialItems(reader, kind, 'tenant', new Date(0), { limit: 12 });
    expect(items[0].data.featuredImage).toBeNull();
    expect(JSON.stringify(items)).not.toContain('.jpg');
  });
  it('does not select an image inside a hidden or scheduled body widget', async () => {
    const reader = { publishedObjects: vi.fn().mockResolvedValue([{ data: {}, widgets: { main: [
      { type: 'easy_widgets.ContentWidget', isVisible: false, config: { content: '<img src="/hidden.jpg">' } },
      { type: 'easy_widgets.ContentWidget', publish_effective_date: '2999-01-01', config: { content: '<img src="/future.jpg">' } },
    ] } }]) } as unknown as PageReader;
    const items = await editorialItems(reader, 'events', 'tenant', new Date(0), { limit: 12 });
    expect(items[0].data.featuredImage).toBeNull();
    expect(JSON.stringify(items)).not.toContain('.jpg');
  });
  it('filters events before the limit and only resolves live published columnists', async () => {
    const reader = { publishedObjects: vi.fn().mockResolvedValue([]) } as unknown as PageReader;
    expect(await editorialItems(reader, 'events', 'tenant', new Date(0), { limit: 12, eventGroup: 'other' })).toEqual([]);
    expect(reader.publishedObjects).toHaveBeenLastCalledWith(expect.objectContaining({ eventGroup: 'other', objectTypeNames: ['event'], limit: 12 }), 'tenant', new Date(0));
    expect(await columnistId(reader, 'tenant', new Date(0), 'absent')).toBeNull();
    expect(reader.publishedObjects).toHaveBeenLastCalledWith(expect.objectContaining({ slug: 'absent', objectTypeNames: ['columnist'], activeTypeOnly: true }), 'tenant', new Date(0));
  });
});
