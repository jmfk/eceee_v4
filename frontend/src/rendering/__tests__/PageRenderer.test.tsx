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
                hero: [{ id: 'hero', type: 'easy_widgets.HeroWidget', config: { header: 'Hero', image: { imgproxyBaseUrl: 'https://example.com/hero.jpg' } } }],
                sidebar: [{ id: 'empty-nav', type: 'easy_widgets.NavigationWidget', config: { menuItems: [] } }],
            },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.header-widget.widget-type-header')).toBeTruthy()
        expect(container.querySelector('.hero-widget')).toHaveStyle({ backgroundImage: "url('https://example.com/hero.jpg')" })
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
                data: { status: 'ready', items: [{ id: 1, title: 'Article', slug: 'article', publishDate: '2026-09-27', objectType: { name: 'news', label: 'News' }, data: { featuredImage: '/news.jpg', excerpt: 'Excerpt' } }] },
            }] },
        })

        const { container } = render(<PageRenderer model={model} />)

        expect(container.querySelector('[data-widget-type="news-list"] .news-items-container')).toBeTruthy()
        expect(container.querySelector('.news-featured-image,.news-excerpt,.news-date')).toBeNull()
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
                    { cells: [{ content: '<strong>Ada</strong>', colspan: 2, alignment: 'center' }] },
                    { cells: [{ contentType: 'image', imageData: { url: '/portrait.jpg', alt: 'Ada portrait' }, rowspan: 2, backgroundColor: '#ffeecc', borders: { top: { style: 'thick', color: '#123456' } }, cssClass: 'portrait-cell' }] },
                ],
            } }] },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument()
        expect(screen.getByRole('cell', { name: 'Ada' })).toHaveAttribute('colspan', '2')
        expect(container.querySelector('td strong')).toHaveTextContent('Ada')
        expect(container.querySelector('td > span')).toBeNull()
        expect(container.querySelector('table')).toHaveClass('border')
        expect(container).not.toHaveTextContent('[object Object]')
        expect(container.querySelector('col')).toHaveStyle({ width: '60%' })
        expect(screen.getByRole('img', { name: 'Ada portrait' }).closest('td')).toHaveAttribute('rowspan', '2')
        expect(screen.getByRole('img', { name: 'Ada portrait' }).closest('td')).toHaveClass('cell-image', 'portrait-cell')
        expect(screen.getByRole('img', { name: 'Ada portrait' }).closest('td')).toHaveStyle({ backgroundColor: '#ffeecc', borderTop: '3px solid #123456' })
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
