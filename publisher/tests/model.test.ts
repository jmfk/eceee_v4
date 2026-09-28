import { describe, expect, it } from 'vitest';
import { buildPublishedPageModel, normalizeHostname, type Page, type ReadDb } from '../src/model';
const root: Page = { id: 1, tenant_id: 7, parent_id: null, slug: 'silent', title: 'Home', hostnames: ['example.org'], path_pattern: '' };
const child: Page = { ...root, id: 2, parent_id: 1, slug: 'news', title: 'News', hostnames: [] };
const article: Page = { ...child, id: 3, parent_id: 2, slug: 'story', title: 'Story' };
const db: ReadDb = {
  roots: async () => [root],
  child: async (parent, tenant, slug) => [child, article].find(p => p.parent_id === parent && p.tenant_id === tenant && p.slug === slug) ?? null,
  version: async (id, at) => id === 3 && at >= new Date('2026-01-01') && at < new Date('2027-01-01') ? { id: 10, page_id: 3, meta_title: 'Published story', meta_description: 'Description', code_layout: 'main_layout', widgets: { main: [{ type: 'easy_widgets.HeadlineWidget', config: { content: 'Hello' } }] } } : null,
};
describe('public resolution', () => {
  it('normalizes hosts', () => { expect(normalizeHostname(' Example.ORG:8443 ')).toBe('example.org'); expect(normalizeHostname('evil.org/path')).toBeNull(); });
  it('resolves the silent root and a hierarchy to a serializable public model', async () => {
    const model = await buildPublishedPageModel(db, 'example.org:3000', '/news/story/', new Date('2026-06-01'));
    expect(model?.matchedPath).toBe('/news/story');
    expect(model?.context).toMatchObject({ mode: 'public', preview: false, tenantId: '7', versionId: 10 });
    expect(model?.slots.main[0].config.content).toBe('Hello');
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
  it('rejects unpublished dates, unmatched tails and cross-tenant children', async () => {
    expect(await buildPublishedPageModel(db, 'example.org', '/news/story', new Date('2027-01-01'))).toBeNull();
    expect(await buildPublishedPageModel(db, 'example.org', '/news/story/extra')).toBeNull();
    expect(await buildPublishedPageModel(db, 'other.org', '/')).toBeNull();
    expect(await buildPublishedPageModel({ ...db, child: async () => ({ ...article, parent_id: 1, tenant_id: 9, slug: 'story' }) }, 'example.org', '/story')).toBeNull();
  });
  it('rejects ambiguous roots and dynamic patterns', async () => {
    expect(await buildPublishedPageModel({ ...db, roots: async () => [root, { ...root, id: 9 }] }, 'example.org', '/')).toBeNull();
    expect(await buildPublishedPageModel({ ...db, child: async () => ({ ...child, path_pattern: 'article' }) }, 'example.org', '/news')).toBeNull();
  });
});
