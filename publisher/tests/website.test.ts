import { describe, expect, it } from 'vitest';
import { archiveQuery } from '../src/archive';
import { websiteInfo, websiteSettings, websiteMetadata, safePath, canonicalPath } from '../src/website';
import { analyticsAllowed } from '../src/website-tools';
import type { ReadDb, PublishedPageModel } from '../src/model';

describe('website settings and archives', () => {
  it('bridges stored snake_case settings and keeps consent on by default', () => {
    expect(websiteSettings({ website: { language: 'sv-SE', no_index: true, analytics_enabled: true } })).toMatchObject({ language: 'sv-SE', noIndex: true, analyticsEnabled: true, analyticsRequireConsent: true });
    expect(websiteSettings({ website: { language: 'javascript:alert(1)', translations: { sv: '//bad', en: '7' } } }).translations).toEqual({ en: '7' });
  });
  it.each(['//outside.org', '/a\\evil', '/a?secret=1', '/a#fragment', '/a\nheader'])('rejects unsafe target %s', path => expect(safePath(path)).toBeNull());
  it('uses inclusive UTC dates and filters event dates before pagination', () => {
    const query = archiveQuery(new URLSearchParams({ kind: 'events', q: 'Heat', from: '2026-11-01', to: '2026-11-30', page: '2' }));
    expect(query?.query).toMatchObject({ search: 'Heat', dateFrom: '2026-11-01', dateTo: '2026-12-01', dateField: 'event', offset: 20, limit: 21 });
  });
  it.each([{ from: '2026-02-30' }, { from: '2026-12-01', to: '2026-01-01' }, { kind: 'private' }, { page: '-1' }, { q: 'x'.repeat(201) }])('rejects invalid query %j', params => expect(archiveQuery(new URLSearchParams(Object.entries(params).map(([key, value]) => [key, value!])))).toBeNull());
  it('uses one canonical slashless public target', () => { expect(canonicalPath('/resources/')).toBe('/resources'); expect(canonicalPath('/')).toBe('/'); });
  it('does not collect before consent or after denial, and honors privacy signals', () => {
    const info = { analyticsEnabled: true, analyticsRequireConsent: true };
    expect(analyticsAllowed(info, null, false)).toBe(false);
    expect(analyticsAllowed(info, 'granted', false)).toBe(true);
    expect(analyticsAllowed(info, 'denied', false)).toBe(false);
    expect(analyticsAllowed(info, 'granted', true)).toBe(false);
    expect(analyticsAllowed({ ...info, analyticsRequireConsent: false }, 'denied', false)).toBe(false);
  });
  it('exposes only same-site published translations and public sharing images', async () => {
    const model = { title: 'Title', description: 'Summary', context: { siteId: '1', pageId: '2', tenantId: '7' } } as PublishedPageModel;
    const db = { withSnapshot: async (read: (reader: import('../src/model').PageReader) => unknown) => read({
      version: async (id: string) => ({ page_data: { website: id === '1' ? { language: 'en' } : { language: 'sv', no_index: true, translations: { en: '3', fr: '4' }, share_image_id: '11111111-1111-4111-8111-111111111111' } } }),
      publishedPageReferences: async () => [{ id: '3', root_id: '1', cached_path: '/english' }, { id: '4', root_id: '9', cached_path: '/private/' }],
      publicMedia: async () => ({ files: [{ url: 'https://media.example.org/share.jpg' }] }),
    } as unknown as import('../src/model').PageReader) } as ReadDb;
    const info = await websiteInfo(db, model, 'example.org');
    expect(info.translations).toEqual([{ language: 'en', path: '/english' }]);
    const metadata = websiteMetadata(model, info, 'example.org', '/sv');
    expect(metadata.alternates).toEqual({ canonical: 'https://example.org/sv', languages: { en: 'https://example.org/english' } });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.openGraph).toMatchObject({ images: [{ url: 'https://media.example.org/share.jpg' }] });
  });
});
