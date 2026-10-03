import { describe, expect, it, vi } from 'vitest';
import { buildPublishedPageModel, normalizeHostname, type Page, type PageReader, type PublishedObject, type ReadDb, type Theme, type Version, type Widget } from '../src/model';

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
      main: [{ type: 'easy_widgets.ContentWidget', config: { content: '<p>Hello</p>', component_style: 'card' } }],
      sidebar: [{ id: 'local-side', type: 'easy_widgets.HeadlineWidget', inheritanceBehavior: 'insert_before_parent', config: { content: 'Local sidebar' } }],
    },
  }),
};
const theme: Theme = {
  id: '20', tenant_id: '7', name: 'Public', fonts: { google_fonts: [{ family: 'Open Sans', variants: ['400', '700'], display: 'swap' }] },
  colors: { primary: '#123456' }, css_variables: {},
  design_groups: {}, html_elements: {}, sync_version: 1, updated_at: '2026-01-01T00:00:00Z',
  component_styles: { card: { template: '<article>{{{content}}}</article>', css: { default: '.card { padding: 1rem; }', sm: '.card { padding: 2rem; }' } } },
  image_styles: {}, gallery_styles: {}, carousel_styles: {}, breakpoints: { sm: 700 }, custom_css: 'body { margin: 0; }',
};
const reader: PageReader = {
  root: async hostname => hostname === 'example.org' ? root : null,
  child: async (parent, tenant, slug) => [child, article].find(candidate => candidate.parent_id === parent && candidate.tenant_id === tenant && candidate.slug === slug) ?? null,
  version: async (id, at) => at >= new Date('2026-01-01') && at < new Date('2027-01-01') ? versions[id] ?? null : null,
  theme: async (id, tenant) => id === theme.id && tenant === theme.tenant_id ? theme : null,
  defaultTheme: async tenant => tenant === theme.tenant_id ? theme : null,
  publishedPageReferences: async () => [],
  publishedNavigationPages: async () => [],
  publicMedia: async () => ({ files: [], collections: {} }),
  publishedObjects: async () => [],
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

  it('reads page versions sequentially on the shared snapshot client', async () => {
    let versionReadInFlight = false;
    const sequentialReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        if (versionReadInFlight) throw new Error('concurrent version read');
        versionReadInFlight = true;
        await Promise.resolve();
        try {
          return await reader.version(id, at);
        } finally {
          versionReadInFlight = false;
        }
      },
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(sequentialReader) },
      'example.org',
      '/news/story',
      new Date('2026-06-01'),
    );

    expect(model?.context.versionId).toBe('10');
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

  it('filters unpublished and scheduled widgets inside recursive container slots', async () => {
    const nestedReader = {
      ...reader,
      version: async (id: string, at: Date) => {
        const selected = await reader.version(id, at);
        if (id !== article.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [{
          id: 'section',
          type: 'easy_widgets.SectionWidget',
          config: { slots: { content: [
            { id: 'visible', type: 'easy_widgets.HeadlineWidget', config: { content: 'Visible' } },
            { id: 'draft', type: 'easy_widgets.HeadlineWidget', isPublished: false, config: { content: 'Draft' } },
            { id: 'future', type: 'easy_widgets.HeadlineWidget', publishEffectiveDate: '2026-07-01T00:00:00Z', config: { content: 'Future' } },
            { id: 'expired', type: 'easy_widgets.HeadlineWidget', publishExpireDate: '2026-05-01T00:00:00Z', config: { content: 'Expired' } },
            { id: 'columns', type: 'easy_widgets.TwoColumnsWidget', config: { slots: { left: [
              { id: 'deep-draft', type: 'easy_widgets.ContentWidget', is_published: false, config: { content: 'Deep draft' } },
            ], right: [
              { id: 'deep-visible', type: 'easy_widgets.ContentWidget', config: { content: 'Deep visible' } },
            ] } } },
          ] } },
        }, {
          id: 'detail',
          type: 'object_storage.ObjectDetailWidget',
          config: { objectId: 41 },
        }] } });
      },
      publishedObjects: async () => [{
        id: '41',
        title: 'Nested object',
        slug: 'nested-object',
        objectType: { id: '5', name: 'article', label: 'Article', pluralLabel: 'Articles' },
        data: {},
        widgets: { body: [
          { id: 'object-draft', type: 'easy_widgets.ContentWidget', isPublished: false, config: { content: 'Object draft' } },
          { id: 'object-visible', type: 'easy_widgets.ContentWidget', config: { content: 'Object visible' } },
        ] },
        metadata: {},
        publishDate: '2026-05-01T00:00:00Z',
        isFeatured: false,
      }],
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(nestedReader) },
      'example.org',
      '/news/story',
      new Date('2026-06-01'),
    );
    const section = model?.slots.main[0];
    const nested = section?.config.slots as Record<string, Widget[]>;

    expect(nested.content.map(widget => widget.id)).toEqual(['visible', 'columns']);
    expect((nested.content[1].config.slots as Record<string, Widget[]>).left).toEqual([]);
    expect((nested.content[1].config.slots as Record<string, Widget[]>).right.map(widget => widget.id)).toEqual(['deep-visible']);
    const detailItem = model?.slots.main[1].data?.item as { widgets: Record<string, Widget[]> };
    expect(detailItem.widgets.body.map(widget => widget.id)).toEqual(['object-visible']);
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

  it('resolves same-site page links and public media collections inside one snapshot', async () => {
    const inlineMediaId = '411f8c75-c95a-429b-a485-65839b868795';
    const publishedPageReferences = vi.fn(async (ids: string[], tenant: string, site: string) => ids.includes(child.id) && tenant === root.tenant_id && site === root.id ? [{ id: child.id, cached_path: '/news/' }] : []);
    const publicMedia = vi.fn(async () => ({ files: [{ id: inlineMediaId, url: '/inline.png', type: 'image' as const, altText: 'Inline', caption: '', annotation: '', title: 'Inline', width: 460, height: 275, thumbnailUrl: '/inline.png' }], collections: { '67d9020f-1d73-47be-bd24-1fe52d2dbef8': [{ id: 'a', url: '/logo.png', type: 'image' as const, altText: 'Partner', caption: '', annotation: '', title: 'Partner', width: 100, height: 50, thumbnailUrl: '/logo.png' }] } }));
    const enrichedReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== article.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [
          { id: 'nav', type: 'easy_widgets.NavigationWidget', config: { menuItems: [{ linkData: { type: 'internal', pageId: child.id, anchor: 'agenda', label: 'News' } }, { linkData: { type: 'internal', pageId: '999', label: 'Missing' } }, { linkData: { type: 'internal', pageId: 'invalid', label: 'Invalid' } }] } },
          { id: 'copy', type: 'easy_widgets.ContentWidget', config: { content: `<p><a data-page-id="2" href="#">News</a><a href="{&quot;type&quot;:&quot;internal&quot;,&quot;pageId&quot;:2,&quot;anchor&quot;:&quot;details&quot;}">Structured</a><a href="{&quot;type&quot;:&quot;external&quot;,&quot;url&quot;:&quot;https://example.net&quot;}">External</a><a data-page-id="999" href="#">Missing</a></p><div data-media-insert="true" data-media-id="${inlineMediaId}" data-width="medium"><img src="/old.png"></div>` } },
          { id: 'logos', type: 'easy_widgets.ImageWidget', config: { collection_id: '67d9020f-1d73-47be-bd24-1fe52d2dbef8', display_type: 'gallery' } },
          { id: 'section', type: 'easy_widgets.SectionWidget', config: { slots: { content: [
            { id: 'nested-logos', type: 'easy_widgets.ImageWidget', config: { collection_id: '67d9020f-1d73-47be-bd24-1fe52d2dbef8' } },
            { id: 'subpages', type: 'easy_widgets.NavigationWidget', config: { navigation_style: 'sub-page-navigation', menu_items: [] } },
            { id: 'broken-collection', type: 'easy_widgets.ImageWidget', config: { collection_id: 'not-a-uuid' } },
          ] } } },
        ] } });
      },
      publishedPageReferences,
      publishedNavigationPages: async () => [{ id: '4', parent_id: article.id, title: 'Child page', label: 'Child', slug: 'child', cached_path: '/news/story/child/', sort_order: 0 }],
      publicMedia,
    };

    const previousKey = process.env.PUBLISHER_IMGPROXY_KEY;
    const previousSalt = process.env.PUBLISHER_IMGPROXY_SALT;
    process.env.PUBLISHER_IMGPROXY_KEY = '00'.repeat(32);
    process.env.PUBLISHER_IMGPROXY_SALT = '11'.repeat(32);
    try {
      const model = await buildPublishedPageModel({ withSnapshot: async read => read(enrichedReader) }, 'example.org', '/news/story', new Date('2026-06-01'));
      expect(model?.slots.main[0].config.menuItems).toEqual([
        expect.objectContaining({ linkData: expect.objectContaining({ resolvedUrl: '/news/#agenda', url: '/news/#agenda' }) }),
        expect.objectContaining({ linkData: expect.objectContaining({ isActive: false, isPublished: false }) }),
        expect.objectContaining({ linkData: expect.objectContaining({ isActive: false, isPublished: false }) }),
      ]);
      expect(model?.slots.main[1].config.content).toContain('href="/news/"');
      expect(model?.slots.main[1].config.content).toContain('href="/news/#details"');
      expect(model?.slots.main[1].config.content).toContain('href="https://example.net"');
      expect(model?.slots.main[1].config.content).not.toContain('href="#"');
      expect(model?.slots.main[1].config.content).toContain('src="/inline.png"');
      expect(model?.slots.main[1].config.content).toContain('width="460" height="275"');
      expect(model?.slots.main[1].config.content).not.toContain('style="width:100%');
      expect(model?.slots.main[2].config.mediaItems).toEqual([expect.objectContaining({
        url: '/logo.png',
        src: expect.stringContaining('resize:fit:100:50'),
        srcSet: expect.stringMatching(/resize:fit:100:50.* 1x, .*resize:fit:100:50.* 2x/),
        displayWidth: 100,
        displayHeight: 50,
      })]);
      const nested = (model?.slots.main[3].config.slots as Record<string, Widget[]>).content;
      expect(nested[0].config.mediaItems).toEqual([expect.objectContaining({
        src: expect.stringContaining('resize:fit:100:50'),
        displayWidth: 100,
        displayHeight: 50,
      })]);
      expect(nested[1].config.publisherNavigation).toMatchObject({
        isInherited: true,
        depth: 2,
        currentChildren: [expect.objectContaining({ label: 'Child', path: '/news/story/child/' })],
      });
      expect(publishedPageReferences).toHaveBeenCalledWith([child.id, '999'], root.tenant_id, root.id, expect.any(Date));
      expect(publicMedia).toHaveBeenCalledWith([inlineMediaId], ['67d9020f-1d73-47be-bd24-1fe52d2dbef8'], root.tenant_id);
    } finally {
      if (previousKey === undefined) delete process.env.PUBLISHER_IMGPROXY_KEY;
      else process.env.PUBLISHER_IMGPROXY_KEY = previousKey;
      if (previousSalt === undefined) delete process.env.PUBLISHER_IMGPROXY_SALT;
      else process.env.PUBLISHER_IMGPROXY_SALT = previousSalt;
    }
  });

  it('resolves registered dynamic paths and published object list/detail data', async () => {
    const dynamicPage = page({ ...child, path_pattern: 'news_slug' });
    const publishedObjects = vi.fn(async (query: { slug?: string; activeTypeOnly?: boolean }) => [{
      id: '41', title: 'Dynamic story', slug: query.slug || 'dynamic-story',
      objectType: { id: '5', name: 'news', label: 'News', pluralLabel: 'News' },
      data: { summary: 'Resolved from a published object version.' }, widgets: {}, metadata: {},
      publishDate: '2026-05-01T00:00:00Z', isFeatured: false,
    }]);
    const dynamic = {
      ...reader,
      child: async (parent: string, tenant: string, slug: string) => parent === root.id && tenant === root.tenant_id && slug === 'news' ? dynamicPage : null,
      version: async (id: string, at: Date) => id === dynamicPage.id && at < new Date('2027-01-01') ? version({
        id: '11', page_id: dynamicPage.id, widgets: { main: [
          { id: 'list', type: 'easy_widgets.NewsListWidget', config: { objectTypes: [5], limit: 4 } },
          { id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: { objectTypes: [5], slugVariableName: 'news_slug' } },
        ] },
      }) : reader.version(id, at),
      publishedObjects,
    };
    const model = await buildPublishedPageModel({ withSnapshot: async read => read(dynamic) }, 'example.org', '/news/dynamic-story', new Date('2026-06-01'));
    expect(model?.matchedPath).toBe('/news');
    expect(model?.remainingPath).toBe('dynamic-story/');
    expect(model?.context.pathVariables).toEqual({ news_slug: 'dynamic-story' });
    expect(model?.slots.main[0].data?.items).toEqual([expect.objectContaining({ path: '/news/dynamic-story/' })]);
    expect(model?.slots.main[1].data?.item).toEqual(expect.objectContaining({ slug: 'dynamic-story' }));
    expect(publishedObjects).toHaveBeenCalledTimes(2);
    expect(publishedObjects.mock.calls.every(([query]) => query.activeTypeOnly)).toBe(true);
  });

  it('re-resolves persisted object widget data against current publication state', async () => {
    const publishedObjects = vi.fn(async () => []);
    const staleReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== child.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [
          {
            id: 'stale-list',
            type: 'object_storage.ObjectListWidget',
            config: { objectType: 'article' },
            data: { status: 'ready', items: [{ id: '41', title: 'Expired list item', slug: 'expired-list-item' }] },
          },
          {
            id: 'stale-detail',
            type: 'object_storage.ObjectDetailWidget',
            config: { objectType: 'article', objectSlug: 'expired-detail-item' },
            data: { status: 'ready', item: { id: '42', title: 'Expired detail item', slug: 'expired-detail-item' } },
          },
        ] } });
      },
      publishedObjects,
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(staleReader) },
      'example.org',
      '/news',
      new Date('2026-06-01'),
    );

    expect(model?.slots.main[0].data).toEqual({ status: 'empty', items: [] });
    expect(model?.slots.main[1].data).toEqual({ status: 'empty' });
    expect(publishedObjects).toHaveBeenCalledTimes(2);
  });

  it('uses semantic slug and numeric ID variables for generic object details', async () => {
    const queries: Array<{ slug?: string; objectIds?: string[] }> = [];
    const publishedObjects = vi.fn(async (query: { slug?: string; objectIds?: string[] }) => {
      queries.push(query);
      return [{
        id: query.objectIds?.[0] || '41', title: 'Dynamic object', slug: query.slug || 'numeric-object',
        objectType: { id: '5', name: 'article', label: 'Article', pluralLabel: 'Articles' },
        data: {}, widgets: {}, metadata: {}, publishDate: '2026-05-01T00:00:00Z', isFeatured: false,
      }];
    });
    const dynamicReader = (pathPattern: string): PageReader => ({
      ...reader,
      child: async (parent, tenant, slug) => parent === root.id && tenant === root.tenant_id && slug === 'news'
        ? page({ ...child, path_pattern: pathPattern })
        : null,
      version: async (id, at) => id === child.id && at < new Date('2027-01-01') ? version({
        id: '11', page_id: child.id, widgets: { main: [{
          id: 'detail', type: 'object_storage.ObjectDetailWidget', config: { objectType: 'article' },
        }] },
      }) : reader.version(id, at),
      publishedObjects,
    });

    await buildPublishedPageModel(
      { withSnapshot: async read => read(dynamicReader('date_slug')) },
      'example.org',
      '/news/2026/10/annual-report',
      new Date('2026-06-01'),
    );
    await buildPublishedPageModel(
      { withSnapshot: async read => read(dynamicReader('numeric_id')) },
      'example.org',
      '/news/41',
      new Date('2026-06-01'),
    );

    expect(queries[0]).toMatchObject({
      objectTypeNames: ['article'],
      slug: 'annual-report',
      activeTypeOnly: true,
    });
    expect(queries[1]).toMatchObject({ objectIds: ['41'], activeTypeOnly: true });
  });

  it('keeps an explicitly configured object slug ahead of a numeric route ID', async () => {
    const publishedObjects = vi.fn(async () => []);
    const numericReader: PageReader = {
      ...reader,
      child: async (parent, tenant, slug) => parent === root.id && tenant === root.tenant_id && slug === 'news'
        ? page({ ...child, path_pattern: 'numeric_id' })
        : null,
      version: async (id, at) => id === child.id && at < new Date('2027-01-01') ? version({
        id: '11', page_id: child.id, widgets: { main: [{
          id: 'detail', type: 'object_storage.ObjectDetailWidget',
          config: { objectType: 'article', objectSlug: 'configured-object' },
        }] },
      }) : reader.version(id, at),
      publishedObjects,
    };

    await buildPublishedPageModel(
      { withSnapshot: async read => read(numericReader) },
      'example.org',
      '/news/41',
      new Date('2026-06-01'),
    );

    expect(publishedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ objectTypeNames: ['article'], slug: 'configured-object' }),
      root.tenant_id,
      expect.any(Date),
    );
  });

  it('resolves nested object widgets and fixed object IDs', async () => {
    const publishedObject = {
      id: '41', title: 'Selected object', slug: 'selected-object',
      objectType: { id: '5', name: 'article', label: 'Article', pluralLabel: 'Articles' },
      data: { summary: 'Resolved published data.' },
      widgets: { body: [
        { id: 'object-list', type: 'object_storage.ObjectListWidget', config: { objectType: 'article' } },
      ] },
      metadata: {},
      publishDate: '2026-05-01T00:00:00Z', isFeatured: false,
      level: 1,
      ancestors: [{
        id: '40', title: 'Parent object', slug: 'parent-object',
        objectType: { id: '5', name: 'article', label: 'Article', pluralLabel: 'Articles' },
      }],
      children: [{
        id: '42', title: 'Child object', slug: 'child-object',
        objectType: { id: '5', name: 'article', label: 'Article', pluralLabel: 'Articles' },
        publishDate: '2026-05-02T00:00:00Z',
      }],
    };
    const publishedObjects = vi.fn(async () => [publishedObject]);
    const nestedReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== child.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [
          { id: 'section', type: 'easy_widgets.SectionWidget', config: { slots: { content: [
            { id: 'nested-list', type: 'object_storage.ObjectListWidget', config: { objectType: 'article' } },
          ] } } },
          { id: 'fixed-detail', type: 'object_storage.ObjectDetailWidget', config: { objectId: 41 } },
        ] } });
      },
      publishedObjects,
    };

    const model = await buildPublishedPageModel(
      { withSnapshot: async read => read(nestedReader) },
      'example.org',
      '/news',
      new Date('2026-06-01'),
    );
    const nested = (model?.slots.main[0].config.slots as Record<string, Widget[]>).content[0];
    expect(nested.data?.items).toEqual([expect.objectContaining({ id: '41', path: '/news/selected-object/' })]);
    expect(model?.slots.main[1].data?.item).toEqual(expect.objectContaining({ id: '41' }));
    const resolvedObject = model?.slots.main[1].data?.item as PublishedObject;
    expect(resolvedObject.ancestors).toEqual([expect.objectContaining({ path: '/news/parent-object/' })]);
    expect(resolvedObject.children).toEqual([expect.objectContaining({ path: '/news/child-object/' })]);
    const objectWidgets = resolvedObject.widgets as Record<string, Widget[]>;
    expect(objectWidgets.body[0].data?.items).toEqual([expect.objectContaining({ id: '41' })]);
    expect(publishedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ objectIds: ['41'], limit: 1, includeHierarchy: true }),
      root.tenant_id,
      expect.any(Date),
    );
  });

  it('stops self-referential and mutual published object widget cycles', async () => {
    const object = (id: string, nestedId: string): PublishedObject => ({
      id,
      title: `Object ${id}`,
      slug: `object-${id}`,
      objectType: { id: '5', name: 'article', label: 'Article', pluralLabel: 'Articles' },
      data: {},
      widgets: { body: [{ id: `detail-${nestedId}`, type: 'object_storage.ObjectDetailWidget', config: { objectId: nestedId } }] },
      metadata: {},
      publishDate: '2026-05-01T00:00:00Z',
      isFeatured: false,
    });
    const runCycle = async (objects: Record<string, PublishedObject>) => {
      const publishedObjects = vi.fn(async (query: { objectIds?: string[] }) => {
        const selected = objects[String(query.objectIds?.[0])];
        return selected ? [selected] : [];
      });
      const cycleReader: PageReader = {
        ...reader,
        version: async (id, at) => {
          const selected = await reader.version(id, at);
          if (id !== child.id || !selected) return selected;
          return version({ ...selected, widgets: { main: [
            { id: 'cycle-root', type: 'object_storage.ObjectDetailWidget', config: { objectId: 41 } },
          ] } });
        },
        publishedObjects,
      };
      const model = await buildPublishedPageModel(
        { withSnapshot: async read => read(cycleReader) },
        'example.org',
        '/news',
        new Date('2026-06-01'),
      );
      return { model, publishedObjects };
    };

    const selfCycle = await runCycle({ '41': object('41', '41') });
    const selfNested = ((selfCycle.model?.slots.main[0].data?.item as PublishedObject).widgets as Record<string, Widget[]>).body[0];
    expect((selfNested.data?.item as PublishedObject).widgets).toEqual({});
    expect(selfCycle.publishedObjects).toHaveBeenCalledTimes(2);

    const mutualCycle = await runCycle({ '41': object('41', '42'), '42': object('42', '41') });
    const firstNested = ((mutualCycle.model?.slots.main[0].data?.item as PublishedObject).widgets as Record<string, Widget[]>).body[0];
    const secondNested = (((firstNested.data?.item as PublishedObject).widgets as Record<string, Widget[]>).body[0]);
    expect((secondNested.data?.item as PublishedObject).widgets).toEqual({});
    expect(mutualCycle.publishedObjects).toHaveBeenCalledTimes(3);
  });

  it('uses the Django item count for every TopNews layout', async () => {
    const queries: Array<{ limit: number; pinnedFirst?: boolean; activeTypeOnly?: boolean }> = [];
    const publishedObjects = vi.fn(async (query: { limit: number; pinnedFirst?: boolean; activeTypeOnly?: boolean }) => {
      queries.push(query);
      return [];
    });
    const topNewsReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== child.id || !selected) return selected;
        return version({ ...selected, widgets: { main: ['1x2', '1x3', '2x3_2', '2x1', '2x2'].map(layout => ({
          id: `top-${layout}`,
          type: 'easy_widgets.TopNewsPlugWidget',
          config: { objectTypes: ['news'], layout },
        })) } });
      },
      publishedObjects,
    };

    await buildPublishedPageModel(
      { withSnapshot: async read => read(topNewsReader) },
      'example.org',
      '/news',
      new Date('2026-06-01'),
    );

    expect(queries.map(query => query.limit)).toEqual([2, 3, 5, 2, 4]);
    expect(queries.every(query => query.pinnedFirst)).toBe(true);
    expect(queries.every(query => query.activeTypeOnly)).toBe(true);
  });

  it('preserves Django object-type defaults for NewsList and top-news widgets', async () => {
    const queries: Array<{
      objectTypeIds?: string[];
      objectTypeNames?: string[];
      allActiveTypes?: boolean;
    }> = [];
    const publishedObjects = vi.fn(async (query: {
      objectTypeIds?: string[];
      objectTypeNames?: string[];
      allActiveTypes?: boolean;
    }) => {
      queries.push(query);
      return [];
    });
    const defaultReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== child.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [
          { id: 'news-list', type: 'easy_widgets.NewsListWidget', config: {} },
          { id: 'news-list-invalid', type: 'easy_widgets.NewsListWidget', config: { objectTypes: [''] } },
          { id: 'news-list-null', type: 'easy_widgets.NewsListWidget', config: { objectTypes: null } },
          { id: 'top-default', type: 'easy_widgets.TopNewsPlugWidget', config: {} },
          { id: 'sidebar-default', type: 'easy_widgets.SidebarTopNewsWidget', config: {} },
          { id: 'top-empty', type: 'easy_widgets.TopNewsPlugWidget', config: { objectTypes: [] } },
          { id: 'sidebar-empty', type: 'easy_widgets.SidebarTopNewsWidget', config: { object_types: [] } },
          { id: 'top-null', type: 'easy_widgets.TopNewsPlugWidget', config: { objectTypes: null } },
          { id: 'sidebar-invalid', type: 'easy_widgets.SidebarTopNewsWidget', config: { object_types: 'news' } },
        ] } });
      },
      publishedObjects,
    };

    await buildPublishedPageModel(
      { withSnapshot: async read => read(defaultReader) },
      'example.org',
      '/news',
      new Date('2026-06-01'),
    );

    expect(queries[0]).toMatchObject({ objectTypeIds: [], allActiveTypes: true });
    expect(queries[1]).toMatchObject({ objectTypeIds: [], allActiveTypes: false });
    expect(queries[2]).toMatchObject({ objectTypeIds: [], allActiveTypes: false });
    expect(queries[3].objectTypeNames).toEqual(['news']);
    expect(queries[4].objectTypeNames).toEqual(['news']);
    expect(queries[5].objectTypeNames).toEqual([]);
    expect(queries[6].objectTypeNames).toEqual([]);
    expect(queries[7].objectTypeNames).toEqual([]);
    expect(queries[8].objectTypeNames).toEqual([]);
  });

  it('loads ObjectList hierarchy only when it is configured for display', async () => {
    const queries: Array<{ includeHierarchy?: boolean }> = [];
    const publishedObjects = vi.fn(async (query: { includeHierarchy?: boolean }) => {
      queries.push(query);
      return [];
    });
    const listReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== child.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [
          { id: 'hierarchy', type: 'object_storage.ObjectListWidget', config: { objectType: 'article', show_hierarchy: true } },
          { id: 'flat', type: 'object_storage.ObjectListWidget', config: { objectType: 'article', showHierarchy: false } },
        ] } });
      },
      publishedObjects,
    };

    await buildPublishedPageModel(
      { withSnapshot: async read => read(listReader) },
      'example.org',
      '/news',
      new Date('2026-06-01'),
    );

    expect(queries.map(query => query.includeHierarchy)).toEqual([true, false]);
  });

  it('forwards snake- and camel-case ObjectList status filters and requires an active type', async () => {
    const queries: Array<{ status?: string; activeTypeOnly?: boolean }> = [];
    const statusReader: PageReader = {
      ...reader,
      version: async (id, at) => {
        const selected = await reader.version(id, at);
        if (id !== child.id || !selected) return selected;
        return version({ ...selected, widgets: { main: [
          {
            id: 'camel-status',
            type: 'object_storage.ObjectListWidget',
            config: { objectType: 'article', statusFilter: 'archived' },
          },
          {
            id: 'snake-status',
            type: 'object_storage.ObjectListWidget',
            config: { object_type: 'article', status_filter: 'draft' },
          },
        ] } });
      },
      publishedObjects: async query => {
        queries.push(query);
        return [];
      },
    };

    await buildPublishedPageModel(
      { withSnapshot: async read => read(statusReader) },
      'example.org',
      '/news',
      new Date('2026-06-01'),
    );

    expect(queries).toEqual([
      expect.objectContaining({ status: 'archived', activeTypeOnly: true }),
      expect.objectContaining({ status: 'draft', activeTypeOnly: true }),
    ]);
  });

  it('rejects unknown, malformed and unmatched dynamic paths', async () => {
    const unknown = { ...reader, child: async () => page({ ...child, path_pattern: 'unknown' }) };
    expect(await buildPublishedPageModel({ withSnapshot: async read => read(unknown) }, 'example.org', '/news/story')).toBeNull();
    const dynamic = { ...reader, child: async () => page({ ...child, path_pattern: 'date_slug' }) };
    expect(await buildPublishedPageModel({ withSnapshot: async read => read(dynamic) }, 'example.org', '/news/not-a-date')).toBeNull();
  });
});
