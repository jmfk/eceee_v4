import { describe, expect, it } from 'vitest';
import { buildPublishedPageModel, normalizeHostname, type Page, type PageReader, type ReadDb, type Theme, type Version } from '../src/model';

const page = (values: Partial<Page> & Pick<Page, 'id' | 'tenant_id' | 'parent_id' | 'slug' | 'title'>): Page => ({
  hostnames: [],
  path_pattern: '',
  enable_css_injection: true,
  page_css_variables: {},
  page_custom_css: '',
  ...values,
});
const version = (values: Partial<Version> & Pick<Version, 'id' | 'page_id'>): Version => ({
  meta_title: '',
  meta_description: '',
  code_layout: '',
  widgets: {},
  theme_id: null,
  enable_css_injection: true,
  page_css_variables: {},
  page_custom_css: '',
  ...values,
});
const root = page({ id: '1', tenant_id: '7', parent_id: null, slug: 'silent', title: 'Home', hostnames: ['example.org'] });
const child = page({ id: '2', tenant_id: '7', parent_id: '1', slug: 'news', title: 'News' });
const article = page({ id: '3', tenant_id: '7', parent_id: '2', slug: 'story', title: 'Story' });
const versions: Record<string, Version> = {
  '1': version({
    id: '8', page_id: '1', code_layout: 'main_layout', theme_id: '20',
    widgets: {
      header: [{ id: 'root-header', type: 'easy_widgets.HeaderWidget', inheritanceLevel: -1, config: {} }],
      sidebar: [{ id: 'root-side', type: 'easy_widgets.HeadlineWidget', inheritanceLevel: -1, config: { content: 'Root sidebar' } }],
    },
  }),
  '2': version({
    id: '9', page_id: '2',
    widgets: { sidebar: [{ id: 'parent-side', type: 'easy_widgets.HeadlineWidget', inheritanceLevel: -1, config: { content: 'Parent sidebar' } }] },
  }),
  '3': version({
    id: '10', page_id: '3', meta_title: 'Published story', meta_description: 'Description',
    page_css_variables: { spacing: '2rem' }, page_custom_css: '.story { color: red; }',
    widgets: {
      main: [{ type: 'easy_widgets.ContentWidget', config: { content: '<p>Hello</p>' } }],
      sidebar: [{ id: 'local-side', type: 'easy_widgets.HeadlineWidget', inheritanceBehavior: 'insert_before_parent', config: { content: 'Local sidebar' } }],
    },
  }),
};
const theme: Theme = {
  id: '20', tenant_id: '7', name: 'Public', fonts: { google_fonts: [{ family: 'Open Sans', variants: ['400', '700'], display: 'swap' }] },
  colors: { primary: '#123456' }, css_variables: {},
  component_styles: { card: { template: '<article>{{{content}}}</article>', css: { default: '.card { padding: 1rem; }', sm: '.card { padding: 2rem; }' } } },
  image_styles: {}, gallery_styles: {}, carousel_styles: {}, breakpoints: { sm: 700 }, custom_css: 'body { margin: 0; }',
};
const reader: PageReader = {
  root: async hostname => hostname === 'example.org' ? root : null,
  child: async (parent, tenant, slug) => [child, article].find(candidate => candidate.parent_id === parent && candidate.tenant_id === tenant && candidate.slug === slug) ?? null,
  version: async (id, at) => at >= new Date('2026-01-01') && at < new Date('2027-01-01') ? versions[id] ?? null : null,
  theme: async (id, tenant) => id === theme.id && tenant === theme.tenant_id ? theme : null,
  defaultTheme: async tenant => tenant === theme.tenant_id ? theme : null,
};
const db: ReadDb = { withSnapshot: async read => read(reader) };

describe('public resolution', () => {
  it('normalizes hosts', () => {
    expect(normalizeHostname(' Example.ORG:8443 ')).toBe('example.org');
    expect(normalizeHostname('evil.org/path')).toBeNull();
  });

  it('resolves layout, theme and a hierarchy to a serializable public model', async () => {
    const model = await buildPublishedPageModel(db, 'example.org:3000', '/news/story/', new Date('2026-06-01'));
    expect(model?.matchedPath).toBe('/news/story');
    expect(model?.layout).toBe('main_layout');
    expect(model?.context).toMatchObject({ mode: 'public', preview: false, tenantId: '7', siteId: '1', pageId: '3', versionId: '10' });
    expect(model?.slots.main[0].config.content).toBe('<p>Hello</p>');
    expect(model?.themeCss).toContain('--primary: #123456');
    expect(model?.themeCss).toContain('--spacing: 2rem');
    expect(model?.themeCss).toContain('.card { padding: 1rem; }');
    expect(model?.fontCss).toContain("family=Open+Sans:wght@400;700&display=swap");
    expect(model?.themeCss).not.toContain('@import');
    expect(model?.themeCss).toContain('@media (min-width: 700px)');
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('applies the public renderer inheritance behavior and ordering across ancestors', async () => {
    const model = await buildPublishedPageModel(db, 'example.org', '/news/story', new Date('2026-06-01'));
    expect(model?.slots.header).toEqual([expect.objectContaining({ id: 'root-header', inheritedFrom: { id: '1', title: 'Home', depth: 2 } })]);
    expect(model?.slots.sidebar.map(widget => widget.id)).toEqual(['local-side', 'root-side', 'parent-side']);
    expect(model?.slots.sidebar[2].inheritedFrom).toEqual({ id: '2', title: 'News', depth: 1 });
  });

  it('filters scheduled, expired and non-inheritable widgets', async () => {
    const scheduledReader = {
      ...reader,
      version: async (id: string, at: Date) => {
        const selected = await reader.version(id, at);
        if (id !== '1' || !selected) return selected;
        return version({ ...selected, widgets: { header: [
          { id: 'local-only', type: 'easy_widgets.HeaderWidget', inheritanceLevel: 0, config: {} },
          { id: 'future', type: 'easy_widgets.HeaderWidget', inheritanceLevel: -1, publishEffectiveDate: '2026-07-01T00:00:00Z', config: {} },
        ] } });
      },
    };
    const model = await buildPublishedPageModel({ withSnapshot: async read => read(scheduledReader) }, 'example.org', '/news/story', new Date('2026-06-01'));
    expect(model?.slots.header).toEqual([]);
  });

  it('keeps page CSS disabled when the published version enables it', async () => {
    const disabledArticle = page({
      ...article,
      enable_css_injection: false,
      page_css_variables: { pageOnly: 'red' },
      page_custom_css: '.page-only { color: red; }',
    });
    const disabledReader = {
      ...reader,
      child: async (parent: string, tenant: string, slug: string) => {
        const selected = await reader.child(parent, tenant, slug);
        return selected?.id === article.id ? disabledArticle : selected;
      },
      version: async (id: string, at: Date) => {
        const selected = await reader.version(id, at);
        return id === article.id && selected ? version({
          ...selected,
          enable_css_injection: true,
          page_css_variables: { versionOnly: 'blue' },
          page_custom_css: '.version-only { color: blue; }',
        }) : selected;
      },
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(disabledReader) },
      'example.org',
      '/news/story',
      new Date('2026-06-01'),
    );

    expect(model?.themeCss).not.toContain('--pageOnly');
    expect(model?.themeCss).not.toContain('--versionOnly');
    expect(model?.themeCss).not.toContain('.page-only');
    expect(model?.themeCss).not.toContain('.version-only');
  });

  it('uses published-version CSS values instead of merging their page fallbacks', async () => {
    const cssArticle = page({
      ...article,
      page_css_variables: { pageOnly: 'red' },
      page_custom_css: '.page-only { color: red; }',
    });
    const cssReader = {
      ...reader,
      child: async (parent: string, tenant: string, slug: string) => {
        const selected = await reader.child(parent, tenant, slug);
        return selected?.id === article.id ? cssArticle : selected;
      },
      version: async (id: string, at: Date) => {
        const selected = await reader.version(id, at);
        return id === article.id && selected ? version({
          ...selected,
          page_css_variables: { versionOnly: 'blue' },
          page_custom_css: '.version-only { color: blue; }',
        }) : selected;
      },
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(cssReader) },
      'example.org',
      '/news/story',
      new Date('2026-06-01'),
    );

    expect(model?.themeCss).toContain('--versionOnly: blue');
    expect(model?.themeCss).toContain('.version-only');
    expect(model?.themeCss).not.toContain('--pageOnly');
    expect(model?.themeCss).not.toContain('.page-only');
  });

  it('falls back to page CSS when the published version has no overrides', async () => {
    const cssArticle = page({
      ...article,
      page_css_variables: { pageFallback: 'green' },
      page_custom_css: '.page-fallback { color: green; }',
    });
    const fallbackReader = {
      ...reader,
      child: async (parent: string, tenant: string, slug: string) => {
        const selected = await reader.child(parent, tenant, slug);
        return selected?.id === article.id ? cssArticle : selected;
      },
      version: async (id: string, at: Date) => {
        const selected = await reader.version(id, at);
        return id === article.id && selected ? version({
          ...selected,
          page_css_variables: {},
          page_custom_css: '',
        }) : selected;
      },
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(fallbackReader) },
      'example.org',
      '/news/story',
      new Date('2026-06-01'),
    );

    expect(model?.themeCss).toContain('--pageFallback: green');
    expect(model?.themeCss).toContain('.page-fallback');
  });

  it('lets a local override hide all inherited widgets', async () => {
    const overrideReader = {
      ...reader,
      version: async (id: string, at: Date) => {
        const selected = await reader.version(id, at);
        if (id !== '3' || !selected) return selected;
        return version({ ...selected, widgets: { sidebar: [
          { id: 'override', type: 'easy_widgets.HeadlineWidget', inheritFromParent: false, config: { content: 'Only this' } },
        ] } });
      },
    };
    const model = await buildPublishedPageModel({ withSnapshot: async read => read(overrideReader) }, 'example.org', '/news/story', new Date('2026-06-01'));
    expect(model?.slots.sidebar.map(widget => widget.id)).toEqual(['override']);
  });

  it('rejects unpublished dates, unmatched tails and cross-tenant children', async () => {
    expect(await buildPublishedPageModel(db, 'example.org', '/news/story', new Date('2027-01-01'))).toBeNull();
    expect(await buildPublishedPageModel(db, 'example.org', '/news/story/extra')).toBeNull();
    expect(await buildPublishedPageModel(db, 'other.org', '/')).toBeNull();
    const crossTenant = { ...reader, child: async () => page({ ...article, parent_id: '1', tenant_id: '9', slug: 'story' }) };
    expect(await buildPublishedPageModel({ withSnapshot: async read => read(crossTenant) }, 'example.org', '/story')).toBeNull();
  });

  it('uses one snapshot and passes the normalized hostname to root selection', async () => {
    let snapshots = 0;
    let selectedHost = '';
    const observed = { ...reader, root: async (hostname: string) => { selectedHost = hostname; return root; } };
    await buildPublishedPageModel({ withSnapshot: async read => { snapshots++; return read(observed); } }, 'EXAMPLE.ORG:443', '/');
    expect(snapshots).toBe(1);
    expect(selectedHost).toBe('example.org');
  });

  it('rejects dynamic patterns', async () => {
    const dynamic = { ...reader, child: async () => page({ ...child, path_pattern: 'article' }) };
    expect(await buildPublishedPageModel({ withSnapshot: async read => read(dynamic) }, 'example.org', '/news')).toBeNull();
  });
});
