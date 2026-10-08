import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PageRenderer from '../PageRenderer'
import { createPageRenderModel } from '../adapters'
import { getRenderFixture, RENDER_WIDGET_FIXTURES } from '../fixtures'

describe('PageRenderer', () => {
    it.each(Object.keys(RENDER_WIDGET_FIXTURES))('renders %s without editor chrome', (type) => {
        const fixture = getRenderFixture(type)!
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [fixture] } })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector(`[data-widget-type="${type}"]`)).toBeTruthy()
        expect(container.querySelector('.widget-header,.page-editor-widget,[contenteditable="true"]')).toBeNull()
    })

    it.each(Object.keys(RENDER_WIDGET_FIXTURES))('handles empty and malformed config for %s', (type) => {
        const emptyModel = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'empty', type, config: {} }] } })
        const malformedModel = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'malformed', type, config: null }] } })
        const empty = render(<PageRenderer model={emptyModel} />)
        expect(empty.container.querySelector(`[data-widget-type="${type}"]`)).toBeTruthy()
        empty.unmount()
        const malformed = render(<PageRenderer model={malformedModel} />)
        expect(malformed.container.querySelector(`[data-widget-type="${type}"]`)).toBeTruthy()
    })

    it.each(Object.keys(RENDER_WIDGET_FIXTURES))('does not render hidden %s', (type) => {
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'hidden', type, config: { isActive: false } }] } })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector(`[data-widget-type="${type}"]`)).toBeNull()
    })

    it('renders nested container widgets recursively', () => {
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [getRenderFixture('easy_widgets.ThreeColumnsWidget')] } })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelectorAll('[data-widget-type="easy_widgets.ContentWidget"]')).toHaveLength(3)
    })

    it('applies two-column ratios from canonical layout config', () => {
        const model = createPageRenderModel({ widgets: { main: [{
            id: 'columns',
            type: 'easy_widgets.TwoColumnsWidget',
            config: { layoutStyle: '5:1', slots: { left: [], right: [] } },
        }] } })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('.two-columns-widget')).toHaveClass('two-col-ratio-5-1')
    })

    it('renders section borders and closes sibling accordion sections', () => {
        const section = (id: string, title: string) => ({ id, type: 'easy_widgets.SectionWidget', config: {
            enableCollapse: true,
            startExpanded: false,
            accordionMode: true,
            showBorder: true,
            slots: { content: [
                { id: `${id}-title`, type: 'easy_widgets.HeadlineWidget', config: { content: title } },
                { id: `${id}-body`, type: 'easy_widgets.ContentWidget', config: { content: `<p>${title} body</p>` } },
            ] },
        } })
        const model = createPageRenderModel({ widgets: { main: [section('first', 'First'), section('second', 'Second')] } })

        const { container } = render(<PageRenderer model={model} />)
        const sections = container.querySelectorAll('.section-widget')
        expect(sections[0]).toHaveClass('border-enabled', 'section-collapsed')
        fireEvent.click(screen.getAllByRole('button', { name: 'Expand to read more' })[0])
        expect(sections[0]).not.toHaveClass('section-collapsed')
        fireEvent.click(screen.getAllByRole('button', { name: 'Expand to read more' })[0])
        expect(sections[0]).toHaveClass('section-collapsed')
        expect(sections[1]).not.toHaveClass('section-collapsed')
    })

    it('sanitizes rich content', () => {
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'unsafe', type: 'easy_widgets.ContentWidget', config: { content: '<p>Safe</p><script>alert(1)</script>' } }] } })
        const { container } = render(<PageRenderer model={model} />)
        expect(screen.getByText('Safe')).toBeInTheDocument()
        expect(container.querySelector('script')).toBeNull()
    })

    it('applies configured component styles around render output', () => {
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'styled', type: 'easy_widgets.HeadlineWidget', config: { content: 'Styled', componentStyle: 'card' } }] }, context: { componentStyles: { card: { template: '<article class="feature-card">{{{content}}}</article>' } } } })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.feature-card .headline-widget')).toHaveTextContent('Styled')
    })

    it('surfaces unsupported widgets without crashing the page', () => {
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'missing', type: 'missing.Widget', config: {} }] } })
        render(<PageRenderer model={model} />)
        expect(screen.getByRole('alert')).toHaveTextContent('Unsupported widget')
    })

    it.each([
        ['loading', 'Loading news…'],
        ['empty', 'No news articles available.'],
        ['error', 'Preview data failed'],
    ])('keeps the page visible when a data widget is %s', (status, expected) => {
        const model = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{
                    id: `news-${status}`,
                    type: 'easy_widgets.NewsListWidget',
                    config: {},
                    data: { status, items: [], error: status === 'error' ? expected : undefined },
                }],
                footer: [{ id: 'footer', type: 'easy_widgets.FooterWidget', config: { text: 'Page remains rendered' } }],
            },
        })
        render(<PageRenderer model={model} />)
        expect(screen.getByText(expected)).toBeInTheDocument()
        expect(screen.getByText('Page remains rendered')).toBeInTheDocument()
    })

    it('normalizes the Django landing_page slot name for the React layout', () => {
        const model = createPageRenderModel({
            layout: 'landing_page',
            widgets: { landing_page: [{ id: 'landing', type: 'easy_widgets.HeadlineWidget', config: { content: 'Landing content' } }] },
        })
        render(<PageRenderer model={model} />)
        expect(screen.getByText('Landing content')).toBeInTheDocument()
    })

    it('uses Django-compatible header, navigation and hero markup without preview placeholders', () => {
        const model = createPageRenderModel({
            widgets: {
                header: [{ id: 'header', type: 'easy_widgets.HeaderWidget', config: {} }],
                navbar: [{ id: 'navbar', type: 'easy_widgets.NavbarWidget', config: { menuItems: [{ linkData: { type: 'internal', label: 'Published', resolvedUrl: '/published/', isPublished: true } }, { linkData: { type: 'internal', label: 'Draft', resolvedUrl: '/draft/', isPublished: false } }] } }],
                hero: [{ id: 'hero', type: 'easy_widgets.HeroWidget', config: { beforeText: 'Before', header: 'Hero', afterText: 'After', image: { imgproxyBaseUrl: 'https://example.com/hero.jpg' } } }],
                sidebar: [{ id: 'empty-nav', type: 'easy_widgets.NavigationWidget', config: { menuItems: [] } }],
            },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.header-widget.widget-type-header')).toBeTruthy()
        expect(container.querySelector('.hero-widget')).toHaveStyle({ backgroundImage: "url('https://example.com/hero.jpg')" })
        expect(container.querySelector('.hero-content > .hero-header')).toHaveTextContent('Hero')
        expect(container.querySelector('.hero-content > .hero-before-text')).toMatchObject({ tagName: 'P' })
        expect(container.querySelector('.hero-content > .hero-after-text')).toMatchObject({ tagName: 'P' })
        expect(container.querySelector('.hero-header')?.parentElement).toHaveClass('hero-content')
        expect(screen.getByText('Published')).toBeInTheDocument()
        expect(screen.queryByText('Draft')).toBeNull()
        expect(screen.queryByText(/Site title|No navigation items|Footer content/)).toBeNull()
    })

    it('uses Django content and banner variants instead of legacy fallback fields', () => {
        const model = createPageRenderModel({
            widgets: {
                main: [
                    { id: 'content', type: 'easy_widgets.ContentWidget', config: { content: '<h1>Bordered</h1>', showBorder: true } },
                    { id: 'banner', type: 'easy_widgets.BannerWidget', config: { bannerMode: 'header', headerContent: '<strong>Canonical banner</strong>', content: 'Legacy fallback', image1Url: '/image.jpg' } },
                ],
            },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.content-widget.border-enabled')).toHaveTextContent('Bordered')
        expect(container.querySelector('.banner-body.mode-header .banner-text')).toHaveTextContent('Canonical banner')
        expect(screen.queryByText('Legacy fallback')).toBeNull()
        expect(container.querySelector('.banner-image')).toBeNull()
    })

    it('keeps resolved same-site navigation when lookup responses do not include hostname caches', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'nav', type: 'easy_widgets.NavigationWidget', config: { menuItems: [
                { linkData: { type: 'internal', label: 'Current site', resolvedUrl: '/current/', siteId: 85 } },
                { linkData: { type: 'internal', label: 'Other site', resolvedUrl: '/other/', siteId: 86 } },
                { linkData: { type: 'external', label: 'External', url: 'https://example.com' } },
            ] } }] },
            context: { siteId: 85, siteHostnames: ['summerstudy.localhost'] },
        })
        render(<PageRenderer model={model} />)
        expect(screen.getByText('Current site')).toBeInTheDocument()
        expect(screen.getByText('External')).toBeInTheDocument()
        expect(screen.queryByText('Other site')).toBeNull()
    })

    it('keeps Navbar links inside the current standalone site', () => {
        const model = createPageRenderModel({
            widgets: { navbar: [{ id: 'navbar', type: 'easy_widgets.NavbarWidget', config: { menuItems: [
                { linkData: { type: 'internal', label: 'Current site', resolvedUrl: '/current/', siteId: 85 } },
                { linkData: { type: 'internal', label: 'Other site', resolvedUrl: '/other/', siteId: 86 } },
                { linkData: { type: 'external', label: 'External', url: 'https://example.com' } },
            ] } }] },
            context: { siteId: 85, siteHostnames: ['summerstudy.localhost'] },
        })

        render(<PageRenderer model={model} />)

        expect(screen.getByText('Current site')).toBeInTheDocument()
        expect(screen.getByText('External')).toBeInTheDocument()
        expect(screen.queryByText('Other site')).toBeNull()
    })

    it('filters unpublished and cross-site navigation children', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'nav', type: 'easy_widgets.NavigationWidget', config: { menuItems: [{
                linkData: { type: 'external', label: 'Parent', url: '/parent/' },
                children: [
                    { linkData: { type: 'internal', label: 'Current child', resolvedUrl: '/current/', siteId: 85 } },
                    { linkData: { type: 'internal', label: 'Other child', resolvedUrl: '/other/', siteId: 86 } },
                    { linkData: { type: 'internal', label: 'Draft child', resolvedUrl: '/draft/', isPublished: false } },
                ],
            }] } }] },
            context: { siteId: 85 },
        })

        render(<PageRenderer model={model} />)

        expect(screen.getByText('Current child')).toBeInTheDocument()
        expect(screen.queryByText('Other child')).toBeNull()
        expect(screen.queryByText('Draft child')).toBeNull()
    })

    it('builds news links from API object type and slug fields', () => {
        const model = createPageRenderModel({
            widgets: { main: [{
                id: 'news',
                type: 'easy_widgets.NewsListWidget',
                config: {},
                data: { status: 'ready', items: [{ id: 1, title: 'Article', slug: 'article', objectType: { name: 'news' } }] },
            }] },
        })

        render(<PageRenderer model={model} />)

        expect(screen.getByRole('link', { name: 'Article' })).toHaveAttribute('href', '/news/article/')
    })

    it('honors news-list display flags and public markup', () => {
        const model = createPageRenderModel({
            widgets: { main: [{
                id: 'news',
                type: 'easy_widgets.NewsListWidget',
                config: { showFeaturedImage: false, showExcerpts: false, showPublishDate: false },
                data: { status: 'ready', items: [{ id: 1, title: 'Article', slug: 'article', isFeatured: true, publishDate: '2026-09-27', objectType: { name: 'news', label: 'News' }, data: { featuredImage: '/news.jpg', excerpt: 'Excerpt' } }] },
            }] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('[data-widget-type="news-list"] .news-items-container')).toBeTruthy()
        expect(container.querySelector('.news-featured-image,.news-excerpt,.news-date')).toBeNull()
        expect(screen.getByText('Pinned')).toBeInTheDocument()
    })

    it('renders top-news and sidebar layouts with their configured fields', () => {
        const item = { id: 1, title: 'Article', slug: 'article', publishDate: '2026-09-27', objectType: { name: 'news', label: 'News' }, data: { featuredImage: '/news.jpg', excerpt: 'Excerpt' } }
        const model = createPageRenderModel({
            widgets: { main: [
                { id: 'top', type: 'easy_widgets.TopNewsPlugWidget', config: { layout: '1x2', showObjectType: false, showPublishDate: false, showExcerpts: false }, data: { status: 'ready', items: [item] } },
                { id: 'side', type: 'easy_widgets.SidebarTopNewsWidget', config: { widgetTitle: 'Latest', showThumbnails: false, showDates: false, showObjectType: true, showExcerpts: true }, data: { status: 'ready', items: [item] } },
            ] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('.top-news-plug-widget.layout-1x2 .news-grid')).toBeTruthy()
        expect(container.querySelector('.top-news-plug-widget .news-type-badge,.top-news-plug-widget .news-date,.top-news-plug-widget .news-excerpt')).toBeNull()
        expect(container.querySelector('.sidebar-top-news-widget .widget-title')).toHaveTextContent('Latest')
        expect(container.querySelector('.sidebar-top-news-widget .news-type-badge')).toHaveTextContent('News')
        expect(container.querySelector('.sidebar-top-news-widget .news-excerpt')).toHaveTextContent('Excerpt')
        expect(container.querySelector('.sidebar-top-news-widget .news-thumbnail,.sidebar-top-news-widget .news-date')).toBeNull()
    })

    it('cleans and truncates top-news excerpts with widget-specific settings', () => {
        const topItem = { id: 1, title: 'Article', slug: 'article', objectType: { name: 'news', label: 'News' }, data: { content: '<p>Alpha beta gamma delta</p>' } }
        const sidebarItem = { ...topItem, id: 2, data: { description: '<p>Alpha beta gamma delta</p>' } }
        const model = createPageRenderModel({
            widgets: { main: [
                { id: 'top', type: 'easy_widgets.TopNewsPlugWidget', config: { excerptLength: 12 }, data: { status: 'ready', items: [topItem] } },
                { id: 'side', type: 'easy_widgets.SidebarTopNewsWidget', config: { showExcerpts: true, excerpt_length: 17 }, data: { status: 'ready', items: [sidebarItem] } },
            ] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('.top-news-plug-widget .news-excerpt')).toHaveTextContent('Alpha beta...')
        expect(container.querySelector('.sidebar-top-news-widget .news-excerpt')).toHaveTextContent('Alpha beta gamma...')
        expect(container).not.toHaveTextContent('<p>')
    })

    it('uses instance metadata rather than version featured state for top-news pinning', () => {
        const versionFeatured = { id: 1, title: 'Version featured', isFeatured: true, metadata: {}, data: {} }
        const metadataPinned = { id: 2, title: 'Metadata pinned', isFeatured: false, metadata: { pinned: true }, data: {} }
        const model = createPageRenderModel({ widgets: { main: [
            { id: 'top', type: 'easy_widgets.TopNewsPlugWidget', config: {}, data: { status: 'ready', items: [versionFeatured, metadataPinned] } },
            { id: 'side', type: 'easy_widgets.SidebarTopNewsWidget', config: {}, data: { status: 'ready', items: [versionFeatured, metadataPinned] } },
        ] } })

        const { container } = render(<PageRenderer model={model} />)
        const topCards = container.querySelectorAll('.top-news-plug-widget .news-card')
        const sidebarItems = container.querySelectorAll('.sidebar-top-news-widget .news-item')

        expect(topCards[0]).not.toHaveClass('pinned')
        expect(topCards[1]).toHaveClass('pinned')
        expect(sidebarItems[0]).not.toHaveClass('pinned')
        expect(sidebarItems[1]).toHaveClass('pinned')
    })

    it('honors news-detail fields and renders object widgets', () => {
        const model = createPageRenderModel({
            widgets: { main: [{
                id: 'detail',
                type: 'easy_widgets.NewsDetailWidget',
                config: { showObjectType: false, showMetadata: false, showFeaturedImage: false, renderObjectWidgets: true },
                data: { status: 'ready', item: { id: 1, title: 'Article', objectType: { label: 'News' }, data: { summary: 'Lead text', content: '<p>Duplicate legacy body</p>', externalUrl: 'https://example.org/source', featuredImage: '/news.jpg' }, widgets: { body: [{ id: 'nested', type: 'easy_widgets.HeadlineWidget', config: { content: 'Nested heading' } }] } } },
            }] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('[data-widget-type="news-detail"] .news-summary')).toHaveTextContent('Lead text')
        expect(container.querySelector('[data-widget-type="news-detail"] .news-content')).toBeNull()
        expect(container.querySelector('.news-type-badge,.news-metadata,.news-featured-image')).toBeNull()
        expect(container.querySelector('.news-object-widgets [data-slot="body"]')).toHaveTextContent('Nested heading')
        expect(screen.getByRole('link', { name: 'Read the original source' })).toHaveAttribute('href', 'https://example.org/source')
    })

    it('matches Django fallback behavior when NewsDetail structured widgets are disabled or filtered out', () => {
        const item = {
            id: 1,
            title: 'Article',
            objectType: { label: 'News' },
            data: { content: '<p>Legacy body</p>' },
            widgets: { body: [{ id: 'nested', type: 'easy_widgets.HeadlineWidget', config: { content: 'Nested heading' } }] },
        }
        const model = createPageRenderModel({ widgets: { main: [
            {
                id: 'disabled', type: 'easy_widgets.NewsDetailWidget', config: { renderObjectWidgets: false },
                data: { status: 'ready', item },
            },
            {
                id: 'filtered', type: 'easy_widgets.NewsDetailWidget', config: { render_object_widgets: true },
                data: { status: 'ready', item: { ...item, id: 2, widgets: { body: [] } } },
            },
        ] } })

        const { container } = render(<PageRenderer model={model} />)
        const details = container.querySelectorAll('[data-widget-type="news-detail"]')

        expect(details[0]).toHaveTextContent('Legacy body')
        expect(details[0]).not.toHaveTextContent('Nested heading')
        expect(details[0].querySelector('.news-object-widgets')).toBeNull()
        expect(details[1]).not.toHaveTextContent('Legacy body')
        expect(details[1].querySelector('.news-object-widgets [data-slot="body"]')).toBeInTheDocument()
    })

    it('formats News dates like Django and shows a useful empty detail state', () => {
        const article = createPageRenderModel({
            widgets: { main: [{
                id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: {},
                data: { status: 'ready', item: { id: 1, title: 'Dated article', data: { presentationalPublishingDate: '2026-09-30' } } },
            }] },
        })
        const rendered = render(<PageRenderer model={article} />)
        expect(rendered.container.querySelector('time')).toHaveTextContent('September 30, 2026')
        rendered.unmount()

        const empty = createPageRenderModel({
            widgets: { main: [{ id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: { emptyMessage: 'Select a golden sample.' }, data: { status: 'ready' } }] },
        })
        render(<PageRenderer model={empty} />)
        expect(screen.getByText('Select a golden sample.')).toBeInTheDocument()
    })

    it('keeps an unmatched detail path silent like the Django widget', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: { emptyMessage: 'Select a golden sample.' }, data: { status: 'empty' } }] },
            context: { pathVariables: { news_slug: 'missing-article' } },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('[data-widget-type="news-detail"]')).toBeNull()
        expect(screen.queryByText('Select a golden sample.')).not.toBeInTheDocument()
    })

    it('renders publisher-only object storage widgets without adding editor fixtures', () => {
        const item = {
            id: 'object-1',
            title: 'Published object',
            path: '/objects/published-object/',
            objectType: { name: 'article', label: 'Article' },
            publishDate: '2026-09-30',
            data: { summary: 'Published summary' },
            widgets: { main: [{ id: 'nested', type: 'easy_widgets.ContentWidget', config: { content: '<p>Published body</p>' } }] },
        }
        const model = createPageRenderModel({ widgets: { main: [
            { id: 'list', type: 'object_storage.ObjectListWidget', config: { showExcerpt: true }, data: { status: 'ready', items: [item] } },
            { id: 'detail', type: 'object_storage.ObjectDetailWidget', config: { showWidgets: true }, data: { status: 'ready', item } },
        ] } })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('[data-widget-type="object-list"]')).toHaveTextContent('Published summary')
        expect(container.querySelector('[data-widget-type="object-detail"]')).toHaveTextContent('Published body')
    })

    it('uses the configured ObjectList excerpt field and length', () => {
        const model = createPageRenderModel({ widgets: { main: [{
            id: 'list',
            type: 'object_storage.ObjectListWidget',
            config: { show_excerpt: true, excerpt_field: 'teaser', excerpt_length: 12 },
            data: { status: 'ready', items: [{
                id: 'object-1', title: 'Published object', slug: 'published-object',
                objectType: { name: 'article', label: 'Article' },
                data: { summary: 'Wrong summary', teaser: 'Alpha beta gamma delta' },
            }] },
        }] } })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('.object-excerpt')).toHaveTextContent('Alpha beta...')
        expect(container.querySelector('.object-excerpt')).not.toHaveTextContent('Wrong summary')
    })

    it('renders ObjectList hierarchy only when enabled', () => {
        const item = {
            id: 'object-1', title: 'Child object', slug: 'child-object', level: 2,
            objectType: { name: 'article', label: 'Article' }, data: {},
            parent: { id: 'parent', title: 'Parent object', objectType: { name: 'article', label: 'Article' } },
            ancestors: [{ id: 'grandparent', title: 'Grandparent object', objectType: { name: 'article', label: 'Article' } }],
        }
        const model = createPageRenderModel({ widgets: { main: [
            { id: 'shown', type: 'object_storage.ObjectListWidget', config: { show_hierarchy: true }, data: { status: 'ready', items: [item] } },
            { id: 'hidden', type: 'object_storage.ObjectListWidget', config: { showHierarchy: false }, data: { status: 'ready', items: [{ ...item, id: 'object-2' }] } },
        ] } })

        const { container } = render(<PageRenderer model={model} />)
        const lists = container.querySelectorAll('[data-widget-type="object-list"]')

        expect(lists[0].querySelector('.object-item')).toHaveClass('level-2')
        expect(lists[0].querySelector('.hierarchy-indicator')).toHaveStyle({ marginLeft: '40px' })
        expect(lists[0]).toHaveTextContent('Child of: Parent object')
        expect(lists[0]).not.toHaveTextContent('Child of: Grandparent object')
        expect(lists[1].querySelector('.object-item')).not.toHaveClass('level-2')
        expect(lists[1].querySelector('.hierarchy-indicator')).toBeNull()
        expect(lists[1]).not.toHaveTextContent('Child of:')
    })

    it('uses the configured NewsList excerpt length and strips source HTML', () => {
        const model = createPageRenderModel({ widgets: { main: [{
            id: 'news',
            type: 'easy_widgets.NewsListWidget',
            config: { show_excerpts: true, excerpt_length: 12 },
            data: { status: 'ready', items: [{
                id: 'news-1', title: 'Published news', slug: 'published-news',
                objectType: { name: 'news', label: 'News' },
                data: { summary: '<p>Alpha beta gamma delta</p>' },
            }] },
        }] } })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('.news-excerpt')).toHaveTextContent('Alpha beta...')
        expect(container.querySelector('.news-excerpt')).not.toHaveTextContent('<p>')
    })

    it('renders ObjectDetail ancestors and published children unless hierarchy is disabled', () => {
        const item = {
            id: 'object-1', title: 'Current object', slug: 'current-object', level: 1,
            objectType: { name: 'article', label: 'Article' }, data: {}, widgets: {},
            ancestors: [{ id: 'parent', title: 'Parent object', path: '/objects/parent-object/', objectType: { name: 'article', label: 'Article' } }],
            children: [{ id: 'child', title: 'Child object', path: '/objects/child-object/', publishDate: '2026-09-30', objectType: { name: 'article', label: 'Article' } }],
        }
        const model = createPageRenderModel({ widgets: { main: [
            { id: 'shown', type: 'object_storage.ObjectDetailWidget', config: {}, data: { status: 'ready', item } },
            { id: 'hidden', type: 'object_storage.ObjectDetailWidget', config: { show_hierarchy: false }, data: { status: 'ready', item: { ...item, id: 'object-2' } } },
        ] } })

        const { container } = render(<PageRenderer model={model} />)
        const details = container.querySelectorAll('[data-widget-type="object-detail"]')

        expect(details[0]).toHaveTextContent('Location in hierarchy:')
        expect(details[0].querySelector('.breadcrumb a')).toHaveAttribute('href', '/objects/parent-object/')
        expect(details[0]).toHaveTextContent('Related Content')
        expect(details[0].querySelector('.child-title a')).toHaveAttribute('href', '/objects/child-object/')
        expect(details[1].querySelector('.object-hierarchy')).toBeNull()
        expect(details[1].querySelector('.object-children')).toBeNull()
    })

    it('renders ObjectDetail technical metadata only when enabled', () => {
        const item = {
            id: 'object-1', title: 'Published object', slug: 'published-object', level: 2,
            objectType: { name: 'article', label: 'Article' }, data: {}, widgets: {},
            createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-30T12:00:00Z',
            metadata: { source: 'archive' },
        }
        const model = createPageRenderModel({ widgets: { main: [
            { id: 'shown', type: 'object_storage.ObjectDetailWidget', config: { show_metadata: true }, data: { status: 'ready', item } },
            { id: 'hidden', type: 'object_storage.ObjectDetailWidget', config: { showMetadata: false }, data: { status: 'ready', item: { ...item, id: 'object-2' } } },
        ] } })

        const { container } = render(<PageRenderer model={model} />)
        const details = container.querySelectorAll('[data-widget-type="object-detail"]')

        expect(details[0]).toHaveTextContent('Technical Details')
        expect(details[0]).toHaveTextContent('Object ID: object-1')
        expect(details[0]).toHaveTextContent('Slug: published-object')
        expect(details[0]).toHaveTextContent('Tree Level: 2')
        expect(details[0]).toHaveTextContent('Created: September 1, 2026 10:00 AM')
        expect(details[0]).toHaveTextContent('Last Updated: September 30, 2026 12:00 PM')
        expect(details[0]).toHaveTextContent('{"source":"archive"}')
        expect(details[1].querySelector('.object-metadata')).toBeNull()
    })

    it('formats ObjectDetail metadata timestamps as one UTC instant', () => {
        const model = createPageRenderModel({ widgets: { main: [{
            id: 'detail', type: 'object_storage.ObjectDetailWidget', config: { showMetadata: true },
            data: { status: 'ready', item: {
                id: 'object-1', title: 'Published object', slug: 'published-object', level: 0,
                objectType: { name: 'article', label: 'Article' }, data: {}, widgets: {},
                createdAt: '2026-09-01T23:30:00-04:00',
            } },
        }] } })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('.object-metadata')).toHaveTextContent('Created: September 2, 2026 3:30 AM')
    })

    it('falls back to published object data when structured widgets are disabled or absent', () => {
        const item = {
            id: 'object-1',
            title: 'Published object',
            objectType: { name: 'article', label: 'Article' },
            data: { summary: 'Published summary', audience_name: 'Members' },
            widgets: { main: [{ id: 'nested', type: 'easy_widgets.ContentWidget', config: { content: '<p>Hidden body</p>' } }] },
        }
        const model = createPageRenderModel({ widgets: { main: [
            { id: 'disabled', type: 'object_storage.ObjectDetailWidget', config: { showWidgets: false }, data: { status: 'ready', item } },
            { id: 'absent', type: 'object_storage.ObjectDetailWidget', config: {}, data: { status: 'ready', item: { ...item, id: 'object-2', widgets: {} } } },
        ] } })

        const { container } = render(<PageRenderer model={model} />)

        const details = container.querySelectorAll('[data-widget-type="object-detail"]')
        expect(details[0]).toHaveTextContent('Published summary')
        expect(details[0]).toHaveTextContent('audience name')
        expect(details[0]).not.toHaveTextContent('Hidden body')
        expect(details[1]).toHaveTextContent('Published summary')
    })

    it('does not expose raw object data when structured widget slots are present but empty', () => {
        const model = createPageRenderModel({ widgets: { main: [{
            id: 'detail', type: 'object_storage.ObjectDetailWidget', config: { showWidgets: true },
            data: { status: 'ready', item: {
                id: 'object-1', title: 'Published object',
                objectType: { name: 'article', label: 'Article' },
                data: { internal_note: 'Must stay hidden' },
                widgets: { main: [] },
            } },
        }] } })

        const { container } = render(<PageRenderer model={model} />)
        const detail = container.querySelector('[data-widget-type="object-detail"]')

        expect(detail).not.toHaveTextContent('Must stay hidden')
        expect(detail?.querySelector('[data-slot="main"]')).toBeInTheDocument()
    })

    it('uses Django compact date formatting in top-news and sidebar views', () => {
        const item = {
            id: 1,
            title: 'Compact date article',
            publishDate: '2026-09-30',
            objectType: { name: 'news', label: 'News' },
        }
        const model = createPageRenderModel({
            widgets: { main: [
                { id: 'top', type: 'easy_widgets.TopNewsPlugWidget', config: {}, data: { status: 'ready', items: [item] } },
                { id: 'side', type: 'easy_widgets.SidebarTopNewsWidget', config: { showDates: true }, data: { status: 'ready', items: [item] } },
            ] },
        })

        const { container } = render(<PageRenderer model={model} />)
        const dates = Array.from(container.querySelectorAll('time')).map((element) => element.textContent)
        expect(dates).toEqual(['Sep 30, 2026', 'Sep 30, 2026'])
    })

    it('normalizes imported media inserts to the Django figure structure', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'content', type: 'easy_widgets.ContentWidget', config: {
                content: '<div data-media-insert="true" data-width="full" data-align="center"><img src="/diagram.svg" alt="Migration diagram"></div>',
            } }] },
        })
        const { container } = render(<PageRenderer model={model} />)
        const figure = container.querySelector('figure.media-insert.img-width-full.media-align-center')
        const image = screen.getByRole('img', { name: 'Migration diagram' })
        expect(figure).toContainElement(image)
        expect(image).toHaveClass('img-width-full')
        expect(image).toHaveAttribute('loading', 'lazy')
    })

    it('preserves media collections and lightbox links in content', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'content', type: 'easy_widgets.ContentWidget', config: {
                content: '<div data-media-insert="true" data-media-type="collection"><div class="media-gallery"><img src="/one.jpg" alt="One"><img src="/two.jpg" alt="Two"></div></div>'
                    + '<div data-media-insert="true" data-media-type="image"><a data-lightbox href="/full.jpg"><img src="/thumb.jpg" alt="Thumbnail"></a></div>',
            } }] },
        })

        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelectorAll('.media-gallery img')).toHaveLength(2)
        expect(screen.getByRole('link', { name: 'Thumbnail' })).toHaveAttribute('href', '/full.jpg')
        expect(screen.getByRole('link', { name: 'Thumbnail' })).toHaveAttribute('data-lightbox')
        expect(container.querySelectorAll('figure.media-insert')).toHaveLength(0)
    })

    it('uses scalar News content only when structured widgets are absent', () => {
        const model = createPageRenderModel({
            widgets: { main: [{
                id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: {},
                data: { status: 'ready', item: { id: 1, title: 'Legacy fallback', data: { content: '<p>Fallback body</p>' } } },
            }] },
        })

        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.news-content')).toHaveTextContent('Fallback body')
    })

    it('hides the news list on detail paths when configured', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'news', type: 'easy_widgets.NewsListWidget', config: { hideOnDetailView: true }, data: { status: 'ready', items: [{ id: 1, title: 'Article' }] } }] },
            context: { pathVariables: { news_slug: 'article' } },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('[data-widget-type="news-list"]')).toBeNull()
    })

    it('renders video slides and moves the carousel with its controls', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'carousel', type: 'easy_widgets.ImageWidget', config: {
                displayType: 'carousel',
                mediaItems: [
                    { id: 1, type: 'video', url: '/intro.mp4', thumbnailUrl: '/intro.jpg' },
                    { id: 2, type: 'image', url: '/second.jpg' },
                ],
            } }] },
        })

        const { container } = render(<PageRenderer model={model} />)
        const track = container.querySelector('.carousel-track')

        expect(container.querySelector('video source')).toHaveAttribute('src', '/intro.mp4')
        expect(track).toHaveStyle({ transform: 'translateX(-0%)' })
        fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
        expect(track).toHaveStyle({ transform: 'translateX(-100%)' })
        expect(screen.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute('aria-current', 'true')
    })

    it('renders responsive image sources supplied by the publisher model', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'image', type: 'easy_widgets.ImageWidget', config: {
                mediaItems: [{
                    id: 1,
                    type: 'image',
                    url: '/original.jpg',
                    src: '/image-1x.webp',
                    srcSet: '/image-1x.webp 1x, /image-2x.webp 2x',
                    displayWidth: 600,
                    displayHeight: 338,
                    altText: 'Responsive image',
                }],
            } }] },
        })

        render(<PageRenderer model={model} />)

        expect(screen.getByRole('img', { name: 'Responsive image' })).toHaveAttribute('src', '/image-1x.webp')
        expect(screen.getByRole('img', { name: 'Responsive image' })).toHaveAttribute('srcset', '/image-1x.webp 1x, /image-2x.webp 2x')
        expect(screen.getByRole('img', { name: 'Responsive image' })).toHaveAttribute('width', '600')
        expect(screen.getByRole('img', { name: 'Responsive image' })).toHaveAttribute('height', '338')
    })

    it('falls back to the widget alt text for legacy media items', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'image', type: 'easy_widgets.ImageWidget', config: {
                mediaItems: [{ id: 1, type: 'image', url: '/legacy.jpg', src: '/legacy-resized.jpg' }],
                altText: 'Legacy image description',
            } }] },
        })

        render(<PageRenderer model={model} />)

        expect(screen.getByRole('img', { name: 'Legacy image description' })).toHaveAttribute('src', '/legacy-resized.jpg')
    })

    it('renders a canonical single image as a single image even with the legacy gallery default', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'image', type: 'easy_widgets.ImageWidget', config: {
                image: {
                    id: 'media-1',
                    imgproxy_base_url: '/full-size.jpg',
                    thumbnail_url: '/thumbnail.jpg',
                    src: '/image-896.webp',
                    title: 'The power of light',
                },
                displayType: 'gallery',
            } }] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(screen.getByRole('img', { name: 'The power of light' })).toHaveAttribute('src', '/image-896.webp')
        expect(container.querySelector('.image-size-medium')).toBeInTheDocument()
        expect(container.querySelector('.gallery-grid')).toBeNull()
    })

    it('renders canonical bio fields and Django-compatible structure', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'bio', type: 'easy_widgets.BioWidget', config: {
                bioText: '<p>Canonical biography</p>',
                caption: 'Portrait caption',
                textLayout: 'flow',
                image: { url: '/portrait.jpg', altText: 'Portrait alt' },
            } }] },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.bio-widget--flow .bio-widget__text')).toHaveTextContent('Canonical biography')
        expect(container.querySelector('.bio-widget__caption')).toHaveTextContent('Portrait caption')
        expect(screen.getByRole('img', { name: 'Portrait alt' })).toHaveAttribute('src', '/portrait.jpg')
        expect(screen.queryByRole('heading', { name: 'Name' })).toBeNull()
    })

    it('renders canonical table rows, headers, HTML and cell spans', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'table', type: 'easy_widgets.TableWidget', config: {
                caption: 'Canonical table',
                columnWidths: ['60%', '40%'],
                rows: [
                    { isHeader: true, cells: [{ content: 'Person' }, { content: 'Role' }] },
                    { height: '40px', backgroundColor: '#f0f0f0', cells: [{ content: '<strong>Ada</strong>', colspan: 2, alignment: 'center', verticalAlignment: 'middle', hoverBgColor: '#ffeecc', hoverTextColor: '#123456' }] },
                    { cells: [{ contentType: 'image', imageData: { url: '/portrait.jpg', alt: 'Ada portrait' }, rowspan: 2, backgroundColor: '#ffeecc', borders: { top: { style: 'thick', color: '#123456' } }, cssClass: 'portrait-cell' }] },
                ],
            } }] },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument()
        expect(screen.getByRole('cell', { name: 'Ada' })).toHaveAttribute('colspan', '2')
        expect(screen.getByRole('cell', { name: 'Ada' })).toHaveClass('cell-v-middle')
        expect(screen.getByRole('cell', { name: 'Ada' })).toHaveClass('cell-hover-bg', 'cell-hover-text')
        expect(screen.getByRole('cell', { name: 'Ada' })).toHaveStyle({ verticalAlign: 'middle' })
        expect(screen.getByRole('cell', { name: 'Ada' })).toHaveStyle({ '--cell-hover-bg': '#ffeecc', '--cell-hover-text': '#123456' })
        expect(screen.getByRole('cell', { name: 'Ada' }).closest('tr')).toHaveStyle({ height: '40px', backgroundColor: '#f0f0f0' })
        expect(container.querySelector('td strong')).toHaveTextContent('Ada')
        expect(container.querySelector('td > span')).toBeNull()
        expect(container.querySelector('table')).toHaveClass('border')
        expect(container).not.toHaveTextContent('[object Object]')
        expect(container.querySelector('col')).toHaveStyle({ width: '60%' })
        expect(screen.getByRole('img', { name: 'Ada portrait' }).closest('td')).toHaveAttribute('rowspan', '2')
        expect(screen.getByRole('img', { name: 'Ada portrait' }).closest('td')).toHaveClass('cell-image', 'portrait-cell')
        expect(screen.getByRole('img', { name: 'Ada portrait' }).closest('td')).toHaveStyle({ backgroundColor: '#ffeecc', borderTop: '3px solid #123456' })
    })

    it('marks borderless tables so shared widget CSS cannot restore cell borders', () => {
        const model = createPageRenderModel({
            widgets: { main: [{
                id: 'table',
                type: 'easy_widgets.TableWidget',
                config: { showBorders: false, rows: [{ cells: [{ content: 'Borderless' }] }] },
            }] },
        })

        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.table-widget')).toHaveClass('table-no-borders')
        expect(screen.getByRole('cell', { name: 'Borderless' })).not.toHaveStyle({ border: '1px solid #d1d5db' })
    })

    it('renders sidebar section descriptors and the HTML fallback', () => {
        const sections = createPageRenderModel({
            widgets: { main: [{ id: 'sidebar', type: 'easy_widgets.SidebarWidget', config: { widgets: [
                { title: 'Information', content: '<p>Section body</p>' },
                { title: 'Links', type: 'list', items: [{ title: 'About', url: '/about/', description: 'Learn more' }] },
            ] } }] },
        })
        const rendered = render(<PageRenderer model={sections} />)
        expect(screen.getByText('Section body')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about/')
        expect(screen.queryByText(/Unsupported widget/)).toBeNull()
        rendered.unmount()

        const fallback = createPageRenderModel({
            widgets: { main: [{ id: 'sidebar-fallback', type: 'easy_widgets.SidebarWidget', config: { content: '<h3>Fallback content</h3>', widgets: [] } }] },
        })
        render(<PageRenderer model={fallback} />)
        expect(screen.getByRole('heading', { name: 'Fallback content' })).toBeInTheDocument()
    })

    it('renders every canonical form field control', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'form', type: 'easy_widgets.FormsWidget', config: {
                title: 'Canonical form',
                fields: [
                    { name: 'phone', label: 'Phone', type: 'phone' },
                    { name: 'count', label: 'Count', type: 'number' },
                    { name: 'message', label: 'Message', type: 'textarea' },
                    { name: 'topic', label: 'Topic', type: 'select', options: ['General'] },
                    { name: 'updates', label: 'Updates', type: 'checkbox', options: ['Email'] },
                    { name: 'priority', label: 'Priority', type: 'radio', options: ['High'] },
                    { name: 'attachment', label: 'Attachment', type: 'file' },
                    { name: 'date', label: 'Date', type: 'date' },
                    { name: 'time', label: 'Time', type: 'time' },
                ],
            } }] },
        })
        render(<PageRenderer model={model} />)
        expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel')
        expect(screen.getByLabelText('Count')).toHaveAttribute('type', 'number')
        expect(screen.getByLabelText('Message').tagName).toBe('TEXTAREA')
        expect(screen.getByLabelText('Topic').tagName).toBe('SELECT')
        expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'checkbox')
        expect(screen.getByLabelText('High')).toHaveAttribute('type', 'radio')
        expect(screen.getByLabelText('Attachment')).toHaveAttribute('type', 'file')
        expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date')
        expect(screen.getByLabelText('Time')).toHaveAttribute('type', 'time')
    })

    it('removes native form submission semantics in public mode', () => {
        const model = createPageRenderModel({
            context: { mode: 'public', preview: false },
            widgets: { main: [{ id: 'form', type: 'easy_widgets.FormsWidget', config: {
                submitUrl: 'https://collector.invalid/submit',
                submitMethod: 'POST',
                fields: [{ name: 'email', label: 'Email', type: 'email' }],
            } }] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('form')).toBeNull()
        expect(container.querySelector('[data-form-status="submission-unavailable"]')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
        expect(screen.getByLabelText('Email')).toBeDisabled()
        expect(screen.getByRole('alert')).toHaveTextContent('Form submission is currently unavailable.')
    })

    it('posts enabled public forms only to the publisher endpoint', () => {
        const model = createPageRenderModel({
            context: {
                mode: 'public',
                preview: false,
                publicForms: {
                    endpointBase: '/api/forms/42',
                    pagePath: '/contact',
                    result: { widgetId: 'form', status: 'success' },
                },
            },
            widgets: { main: [{ id: 'form', type: 'easy_widgets.FormsWidget', config: {
                submitUrl: 'https://collector.invalid/submit',
                storeSubmissions: true,
                successMessage: 'Stored safely',
                fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
            } }] },
        })

        const { container } = render(<PageRenderer model={model} />)
        const form = container.querySelector('form')

        expect(form).toHaveAttribute('action', '/api/forms/42/form')
        expect(form).toHaveAttribute('method', 'post')
        expect(form).not.toHaveAttribute('action', expect.stringContaining('collector.invalid'))
        expect(container.querySelector('input[name="__page_path"]')).toHaveValue('/contact')
        expect(container.querySelector('input[name="__website"]')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
        expect(screen.getByRole('status')).toHaveTextContent('Stored safely')
        expect(screen.getByLabelText(/^Email/)).toHaveAttribute('id', 'form_form_field_email')
    })

    it('keeps public forms with file fields unavailable', () => {
        const model = createPageRenderModel({
            context: { mode: 'public', preview: false, publicForms: { endpointBase: '/api/forms/42', pagePath: '/contact' } },
            widgets: { main: [{ id: 'form', type: 'easy_widgets.FormsWidget', config: {
                fields: [{ name: 'attachment', label: 'Attachment', type: 'file' }],
            } }] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('form')).toBeNull()
        expect(container.querySelector('[data-form-status="submission-unavailable"]')).toBeTruthy()
        expect(screen.getByLabelText('Attachment')).toBeDisabled()
    })

    it('renders content-card image1 with canonical theme classes', () => {
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'card', type: 'easy_widgets.ContentCardWidget', config: {
                header: 'Card heading',
                content: '<p>Card body</p>',
                imageSize: 'rectangle',
                image1: { url: '/card.jpg', altText: 'Card image' },
            } }] },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.content-card-header')).toHaveTextContent('Card heading')
        expect(container.querySelector('.content-card-body.image-size-rectangle .content-card-text')).toHaveTextContent('Card body')
        expect(container.querySelector('.content-card-images .content-card-image')).toHaveAttribute('src', '/card.jpg')
    })
})
