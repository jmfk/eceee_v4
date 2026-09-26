import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../test/testUtils'
import DesignerThemeWorkspacePage from '../DesignerThemeWorkspacePage'

const mocks = vi.hoisted(() => ({
    workspace: vi.fn(), preview: vi.fn(), save: vi.fn(), publish: vi.fn(), undo: vi.fn(), discard: vi.fn(),
    replaceAsset: vi.fn(), createPlaceholder: vi.fn(), savePreviewContent: vi.fn(),
    loadPreviewPage: vi.fn(), loadPreviewObject: vi.fn(), buildResolvedRenderModel: vi.fn(),
    createExport: vi.fn(), getExport: vi.fn(), getExportDownload: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))
vi.mock('../../rendering/directRender', () => ({ buildResolvedRenderModel: mocks.buildResolvedRenderModel }))
vi.mock('../../components/DesignerNavbar', () => ({ default: () => <div>Designer navigation</div> }))
vi.mock('../../components/StatusBar', () => ({ default: ({ customStatusContent }) => <div>{customStatusContent}</div> }))
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useParams: () => ({ themeId: '7' }) }
})

const previewViews = [
    { id: 'page-main', label: 'Article page', kind: 'page', layout: 'main_layout', texts: {}, images: {} },
    { id: 'object-card', label: 'Article card', kind: 'object', layout: 'main_layout', texts: {}, images: {} },
]

const workspace = {
    id: 7, name: 'Editorial', description: 'Theme for editorial sites', syncVersion: 4, liveSyncVersion: 4, draftVersion: 2, hasDraftChanges: false,
    colors: [{ name: 'brand', value: '#123456', usage: ['Article / h1'] }],
    fonts: [{ family: 'Inter', variants: ['400', '700'], display: 'swap', usage: ['Article / h1'] }],
    typography: [{ targetId: 'group:0:element:h1', groupIndex: 0, groupName: 'Article', element: 'h1', values: { fontFamily: 'Inter', fontSize: '32px' } }],
    spacing: [
        { targetId: 'group:0:element:h1', scope: 'element', groupIndex: 0, groupName: 'Article', element: 'h1', values: { marginBottom: '16px' } },
        { targetId: 'group:0:part:content-widget', scope: 'layout', groupIndex: 0, groupName: 'Article', part: 'content-widget', breakpoint: 'md', values: { padding: '24px' } },
    ],
    assets: [{
        assetKey: 'preview', displayName: 'Theme preview image', filename: 'theme-preview.png', url: 'https://storage.test/theme-preview.png',
        kind: 'preview', usage: ['Theme listing preview'], isPlaceholder: false, replaceable: true,
    }, {
        assetKey: 'site-icon', displayName: 'Site icon (favicon)', filename: null, url: null,
        kind: 'site-icon', usage: ['Browser and application icon'], isPlaceholder: true, replaceable: true,
    }, {
        assetKey: 'design:0:hero:md:background', displayName: 'Article hero', kind: 'design-group', usage: ['Article / hero / md / background'],
        requiredWidth: 1600, requiredHeight: 900, requirementSource: 'explicit', dpr: 2, isPlaceholder: true, replaceable: true,
        validation: { status: 'ok', message: 'Explicit dimensions configured.' },
        groupIndex: 0, part: 'content-widget', breakpoint: 'md',
    }, {
        assetKey: 'design:0:hero:sm:background', displayName: 'Article hero mobile', kind: 'design-group', usage: ['Article / hero / sm / background'],
        requiredWidth: 800, requiredHeight: 600, requirementSource: 'explicit', dpr: 2, isPlaceholder: false, replaceable: true,
        filename: 'article-hero-mobile.png', url: 'https://storage.test/article-hero-mobile.png',
        validation: { status: 'ok', message: 'Explicit dimensions configured.' },
        groupIndex: 0, part: 'content-widget', breakpoint: 'sm',
    }, {
        assetKey: 'design:1:menu:xs:background', displayName: 'Callout background', kind: 'design-group', usage: ['Callout / menu / xs / background'],
        requiredWidth: 800, requiredHeight: 300, requirementSource: 'explicit', dpr: 2, isPlaceholder: false, replaceable: true,
        filename: 'callout-background.png', url: 'https://storage.test/callout-background.png',
        groupIndex: 1, part: 'menu', breakpoint: 'xs', property: 'background',
    }],
    canUndo: true,
    breakpoints: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
    contentSources: [
        { id: 12, label: 'conference.example', hostname: 'conference.example' },
        { id: 13, label: 'Draft site', hostname: '' },
    ],
    contentPages: [{
        id: 42, pageId: 42, pageTitle: 'Programme', label: 'conference.example — Programme',
        siteId: 12, siteLabel: 'conference.example', tenantIdentifier: 'theme-tenant', slugPath: 'programme',
        versionId: 9, versionStatus: 'published', layout: 'main_layout',
    }, {
        id: 43, pageId: 43, pageTitle: 'Draft programme', label: 'Draft site — Draft programme',
        siteId: 13, siteLabel: 'Draft site', tenantIdentifier: 'theme-tenant', slugPath: 'draft-programme',
        versionId: 10, versionStatus: 'draft', layout: 'main_layout',
    }, {
        id: 44, pageId: 44, pageTitle: 'Empty page', label: 'Draft site — Empty page',
        siteId: 13, siteLabel: 'Draft site', tenantIdentifier: 'theme-tenant', slugPath: 'empty',
        versionId: null, versionStatus: 'empty', layout: 'main_layout',
    }],
    contentObjects: [{
        id: 55, objectId: 55, objectTitle: 'Welcome article', label: 'Article — Welcome article',
        objectType: 'article', objectTypeLabel: 'Article', versionId: 15,
    }],
    previewContent: { views: previewViews },
    catalog: {
        designGroups: [{
            id: 'group:0', groupIndex: 0, label: 'Article', description: 'Editorial content', slots: ['main'],
            widgetTypes: ['easy_widgets.ContentWidget'],
            elements: [{ id: 'group:0:element:h1', element: 'h1', label: 'Heading 1' }],
            parts: [{ id: 'group:0:part:content-widget', part: 'content-widget', label: 'Content', breakpoints: ['md'] }],
            assetKeys: ['design:0:hero:md:background', 'design:0:hero:sm:background'], colorNames: ['brand'],
        }, {
            id: 'group:1', groupIndex: 1, label: 'Callout', description: 'Short highlighted content', slots: ['main'],
            widgetTypes: ['easy_widgets.ContentWidget'],
            elements: [{ id: 'group:1:element:p', element: 'p', label: 'Paragraph' }],
            parts: [{ id: 'group:1:part:content-widget', part: 'content-widget', label: 'Content', breakpoints: ['md'] }],
            assetKeys: [], colorNames: [],
        }],
        componentStyles: [
            { key: 'feature-card', label: 'Feature card', description: 'Highlighted card', template: '<article class="feature-card">{{{content}}}</article>' },
            { key: 'sub-navigation', label: 'Sub navigation', description: '', template: '{{#isInherited}}{{#hasCurrentChildren}}<nav>{{#currentChildren}}<a href="{{path}}">{{title}}</a>{{/currentChildren}}</nav>{{/hasCurrentChildren}}{{/isInherited}}' },
        ],
        layouts: [{
            key: 'main_layout', label: 'Main layout', description: 'Content and sidebar',
            slots: [{ name: 'hero', label: 'Hero' }, { name: 'main', label: 'Main content' }], parts: [], layoutCss: '.main-layout{display:block}',
            previewTemplate: '<div class="main-layout"><div class="slot-hero">__DESIGNER_SLOT_hero__</div><main class="slot-main">__DESIGNER_SLOT_main__</main></div>',
        }],
        previewViews,
    },
    constraints: { editableTypographyProperties: ['fontFamily', 'fontSize'], editableSpacingProperties: ['marginBottom', 'padding'], maxImageBytes: 10485760 },
}

const selectHeading = async () => {
    await waitFor(() => {
        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:h1', kind: 'element', label: 'Heading 1', text: 'A heading with a realistic length' },
            source: iframe.contentWindow,
        }))
        expect(screen.getByLabelText('Preview text')).toBeInTheDocument()
    })
}

describe('DesignerThemeWorkspacePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.workspace.mockResolvedValue(structuredClone(workspace))
        document.documentElement.lang = 'en'
        mocks.preview.mockResolvedValue({ css: '.designer-preview{color:#123456}', fontUrl: 'https://fonts.googleapis.com/css2?family=Inter' })
        mocks.save.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true })
        mocks.publish.mockResolvedValue({ ...structuredClone(workspace), liveSyncVersion: 5, draftVersion: 4 })
        mocks.undo.mockResolvedValue({ ...structuredClone(workspace), liveSyncVersion: 5, draftVersion: 4, canUndo: false })
        mocks.savePreviewContent.mockImplementation(async (_themeId, viewId, texts) => ({
            ...structuredClone(workspace),
            draftVersion: 3,
            hasDraftChanges: true,
            previewContent: { views: previewViews.map((view) => view.id === viewId ? { ...view, texts } : view) },
        }))
        mocks.loadPreviewPage.mockResolvedValue({ page: { id: 42 }, version: { id: 9 }, inheritance: { slots: {} } })
        mocks.loadPreviewObject.mockResolvedValue({
            object: { id: 55, title: 'Welcome article' },
            objectType: { key: 'article', label: 'Article', schema: {} },
            version: { id: 15, data: { summary: 'Welcome' }, widgets: { main: [] } },
        })
        mocks.buildResolvedRenderModel.mockResolvedValue({
            layout: 'main_layout',
            slots: { main: [{ id: 'page-content', type: 'easy_widgets.ContentWidget', config: { content: '<h1>Programme</h1>' } }] },
            context: { preview: true, tenantId: 'theme-tenant', pageId: 42, versionId: 9 },
        })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('uses the isolated React render frame without exposing internal theme concepts', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        expect(await screen.findByRole('heading', { name: 'Editorial' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Designer views' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Article page' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Article card' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Theme images' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Theme details' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'What to show' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Page elements' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Layout default' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Appearance' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use Feature card' })).not.toBeInTheDocument()
        expect(screen.queryByText('Preview context')).not.toBeInTheDocument()
        expect(screen.queryByText('Design groups')).not.toBeInTheDocument()
        expect(screen.queryByText('Component styles')).not.toBeInTheDocument()
        expect(screen.queryByText('Page content image')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Choose preview image' })).not.toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('src', '/__render-frame')
        expect(screen.getByTitle('Live theme preview')).not.toHaveAttribute('srcdoc')
    })

    it('selects a matching source view but renders deterministic fixtures', async () => {
        const referenceWorkspace = structuredClone(workspace)
        const reference = '<div class="main-layout-container"><div class="slot-main"><div class="widget-type-easy-widgets-contentwidget"><h1>Published site heading</h1></div></div></div>'
        referenceWorkspace.previewContent.views[1].referenceHtml = reference
        referenceWorkspace.previewContent.views[1].sourcePageId = 42
        referenceWorkspace.previewContent.views[1].isSourceHomepage = true
        referenceWorkspace.catalog.previewViews[1].referenceHtml = reference
        referenceWorkspace.catalog.previewViews[1].sourcePageId = 42
        referenceWorkspace.catalog.previewViews[1].isSourceHomepage = true
        mocks.workspace.mockResolvedValue(referenceWorkspace)

        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        expect(screen.getByRole('button', { name: 'Article card' })).toHaveClass('text-blue-700')
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('src', '/__render-frame')
        expect(screen.getByTitle('Live theme preview')).not.toHaveAttribute('srcdoc')
    })

    it('keeps deterministic fixtures independent of browser locale', async () => {
        document.documentElement.lang = 'sv-SE'
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('src', '/__render-frame')
        expect(screen.getByTitle('Live theme preview')).not.toHaveAttribute('srcdoc')
    })

    it('searches theme demo pages and objects in a combobox', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const selector = screen.getByLabelText('Theme demo page or object')
        await user.click(selector)
        await user.clear(selector)
        await user.type(selector, 'Article card')
        await user.click(await screen.findByRole('option', { name: /Article card/ }))

        await waitFor(() => expect(selector).toHaveValue('Article card'))
        expect(screen.getByRole('button', { name: 'Article card' })).toHaveClass('text-blue-700')
    })

    it('can preview a specific page from this tenant independently of its theme', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'content' } })
        expect(screen.getByLabelText('Page or object from your sites')).toHaveValue('conference.example — Programme')
        await waitFor(() => expect(mocks.loadPreviewPage).toHaveBeenCalledWith('7', 42))
        expect(mocks.buildResolvedRenderModel).toHaveBeenCalledWith({
            resolved: expect.objectContaining(workspace.contentPages[0]),
            page: { id: 42 },
            version: { id: 9 },
            rawInheritance: { slots: {} },
        })
        expect(screen.getByRole('button', { name: 'Programme' })).toBeInTheDocument()
        expect(screen.getByText('The selected content is read-only; theme styling remains editable.')).toBeInTheDocument()
    })

    it('searches pages from every site and excludes pages without content', async () => {
        const user = userEvent.setup()
        mocks.loadPreviewPage.mockImplementation(async (_themeId, pageId) => ({
            page: { id: pageId },
            version: { id: pageId === 43 ? 10 : 9 },
            inheritance: { slots: {} },
        }))
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'content' } })

        expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument()
        const selector = screen.getByLabelText('Page or object from your sites')
        await waitFor(() => expect(selector).not.toBeDisabled())
        await user.click(selector)
        await user.clear(selector)
        await user.type(selector, 'Draft programme')
        await user.click(await screen.findByRole('option', { name: /Draft site — Draft programme/ }))
        await waitFor(() => expect(selector).toHaveValue('Draft site — Draft programme'))
        await waitFor(() => expect(selector).not.toBeDisabled())
        await user.clear(selector)
        await user.type(selector, 'Empty page')
        expect(screen.queryByRole('option', { name: /Empty page/ })).not.toBeInTheDocument()
        await waitFor(() => expect(mocks.loadPreviewPage).toHaveBeenCalledWith('7', 43))
    })

    it('searches and previews objects in the same content combobox', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'content' } })
        const selector = screen.getByLabelText('Page or object from your sites')
        await waitFor(() => expect(selector).not.toBeDisabled())
        await user.click(selector)
        await user.clear(selector)
        await user.type(selector, 'Welcome article')
        await user.click(await screen.findByRole('option', { name: /Article — Welcome article/ }))

        await waitFor(() => expect(mocks.loadPreviewObject).toHaveBeenCalledWith('7', 55))
        expect(screen.getByRole('button', { name: 'Welcome article' })).toBeInTheDocument()
    })

    it('shows no preview when there are no pages or objects with content', async () => {
        const emptyWorkspace = structuredClone(workspace)
        emptyWorkspace.previewContent.views = []
        emptyWorkspace.catalog.previewViews = []
        emptyWorkspace.contentPages = emptyWorkspace.contentPages.filter((page) => !page.versionId)
        emptyWorkspace.contentObjects = []
        mocks.workspace.mockResolvedValue(emptyWorkspace)

        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        expect(screen.getByLabelText('Source')).toHaveValue('none')
        expect(screen.getByRole('option', { name: 'No preview content' })).toBeInTheDocument()
        expect(screen.getAllByText('There is no page or object to preview.')).toHaveLength(2)
        expect(screen.queryByTitle('Live theme preview')).not.toBeInTheDocument()
    })

    it('toggles Designer support guides without changing the content source', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
        const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-frame', action: 'ready' },
            source: iframe.contentWindow,
        }))

        expect(screen.getByRole('button', { name: 'Hide guides' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Hide guides' }))
        expect(screen.getByRole('button', { name: 'Show guides' })).toHaveAttribute('aria-pressed', 'false')
        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                source: 'eceee-render-host',
                action: 'render',
                model: expect.objectContaining({ designer: expect.objectContaining({ guidesEnabled: false }) }),
            }),
            '*',
        ))
    })

    it('shows only relevant values after clicking a visible element', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        expect(screen.getByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
        expect(screen.getByLabelText('Preview text')).toHaveValue('A heading with a realistic length')
        expect(screen.getByDisplayValue('32px')).toBeInTheDocument()
        expect(screen.getByDisplayValue('16px')).toBeInTheDocument()
        expect(screen.getByLabelText('brand value')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Choose what to edit' })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Preview content source' })).toBeInTheDocument()

        const accordion = screen.getByRole('button', { name: 'Collapse Heading 1 settings' })
        expect(accordion).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(accordion)
        expect(screen.queryByLabelText('Preview text')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand Heading 1 settings' })).toHaveAttribute('aria-expanded', 'false')

        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'group:0:element:li', kind: 'element', label: 'List item', text: 'Changed nested text' },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand Heading 1 settings' })).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByRole('heading', { name: 'Preview content source' })).toBeInTheDocument()
    })

    it('hides defaults until added and restores the rendered theme default when an override is removed', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:h1', kind: 'element', label: 'Heading 1', text: 'Heading',
                computedStyles: { fontSize: '18px', padding: '10px' },
            },
            source: iframe.contentWindow,
        }))

        expect(screen.queryByLabelText('Inner spacing')).not.toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Add theme value'), { target: { value: 'spacing:0:padding' } })
        expect(screen.getByLabelText('Inner spacing')).toHaveValue('10px')
        expect(screen.getByText('Theme default')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Remove Size' }))
        expect(window.confirm).toHaveBeenCalledWith('Remove Size? It will use the current theme default instead.')
        expect(screen.getByLabelText('Size')).toHaveValue('18px')
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        expect(mocks.save.mock.calls[0][1].typography[0].values.fontSize).toBe('')
    })

    it('hides typography and spacing groups that contain only defaults', async () => {
        const defaultOnlyWorkspace = structuredClone(workspace)
        defaultOnlyWorkspace.typography[0].values = { fontFamily: '', fontSize: '' }
        defaultOnlyWorkspace.spacing[0].values = { marginBottom: '', padding: '' }
        mocks.workspace.mockResolvedValue(defaultOnlyWorkspace)

        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()

        expect(screen.queryByRole('heading', { name: /Typography/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /^Spacing/ })).not.toBeInTheDocument()
        expect(screen.getByLabelText('Add theme value')).toBeInTheDocument()
    })

    it('offers nested elements as alternatives when they share the clicked area', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await waitFor(() => {
            const iframe = screen.getByTitle('Live theme preview')
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview',
                    targetId: 'group:0:element:a',
                    kind: 'element',
                    label: 'Link',
                    text: 'Programme',
                    editable: true,
                    alternatives: [
                        { id: 'group:0:element:a', kind: 'element', label: 'Link', text: 'Programme', editable: true },
                        { id: 'group:0:element:li', kind: 'element', label: 'List item', text: 'Programme', editable: true },
                        { id: 'group:0:element:ul', kind: 'element', label: 'Bullet list', text: 'Programme\nPanels', editable: false },
                    ],
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('heading', { name: 'Choose what to edit' })).toBeInTheDocument()
        })

        expect(screen.getByText('These elements share the same area.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'List item' })).toBeInTheDocument()
        const iframe = screen.getByTitle('Live theme preview')
        const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')
        fireEvent.click(screen.getByRole('button', { name: 'Bullet list' }))
        expect(screen.getByRole('heading', { name: 'Bullet list' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Preview text')).not.toBeInTheDocument()
        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host',
            action: 'selectTarget',
            targetId: 'group:0:element:ul',
        }, '*')
    })

    it('shows theme properties without mixing image replacement into element editing', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await waitFor(() => {
            const iframe = screen.getByTitle('Live theme preview')
            fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', targetId: 'group:0', kind: 'group', label: 'Article' },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('heading', { name: 'Typography · Heading 1' })).toBeInTheDocument()
        })

        expect(screen.queryByRole('heading', { name: 'Theme images' })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Typography · Heading 1' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Spacing · Content · md' })).toBeInTheDocument()
        expect(screen.getByLabelText('brand value')).toBeInTheDocument()
    })

    it('uses a dedicated overview while editing the selected image in the left panel', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: 'Theme images' }))
        expect(screen.getByRole('heading', { name: 'Theme images' })).toBeInTheDocument()
        expect(screen.queryByTitle('Live theme preview')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Select image aspect Article/ }))

        expect(screen.getByRole('button', { name: 'Replace Article hero' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Replace Article hero mobile' })).toBeInTheDocument()
        expect(screen.getByText('Used for theme sizes: MD, LG and XL.')).toBeInTheDocument()
        expect(screen.getByText('Shown from 768 px wide and up.')).toBeInTheDocument()
        expect(screen.getByText('Used for theme size: SM.')).toBeInTheDocument()
        expect(screen.getByText('Shown from 640 px to 767 px wide.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Select image aspect Callout/ }))
        expect(screen.getByText('All sizes')).toBeInTheDocument()
        expect(screen.getByText('Used for all theme sizes: XS, SM, MD, LG and XL.')).toBeInTheDocument()
        expect(screen.getByText('Shown at every screen width.')).toBeInTheDocument()
    })

    it('edits theme identity and uploads preview and favicon images from Theme details', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 4, hasDraftChanges: true })
        const user = userEvent.setup()
        const { container } = renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        await user.click(screen.getByRole('button', { name: 'Theme details' }))
        expect(screen.getByRole('heading', { name: 'Theme details' })).toBeInTheDocument()
        const nameInput = screen.getByRole('textbox', { name: /^Name/ })
        await user.clear(nameInput)
        await user.type(nameInput, 'Editorial 2027')
        await user.clear(screen.getByLabelText('Description'))
        await user.type(screen.getByLabelText('Description'), 'A renewed editorial theme')
        expect(screen.getByRole('heading', { level: 1, name: 'Editorial 2027' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('7', expect.objectContaining({
            name: 'Editorial 2027',
            description: 'A renewed editorial theme',
        })))

        const favicon = new File(['icon'], 'favicon.png', { type: 'image/png' })
        const fileInputs = container.querySelectorAll('input[type="file"]')
        fireEvent.change(fileInputs[1], { target: { files: [favicon] } })
        await waitFor(() => expect(mocks.replaceAsset).toHaveBeenCalledWith('7', 'site-icon', favicon, 3))
    })

    it('keeps the preview visible and shows the responsive image family in the left panel', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'mobile preview' }))

        await waitFor(() => {
            const iframe = screen.getByTitle('Live theme preview')
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview',
                    targetId: 'asset:design:0:hero:sm:background',
                    kind: 'asset',
                    label: 'Article hero mobile',
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('heading', { name: 'Article' })).toBeInTheDocument()
        })

        expect(screen.getByTitle('Live theme preview')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Theme images' })).toHaveClass('text-gray-600')
        expect(screen.getByRole('button', { name: 'Replace Article hero' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Replace Article hero mobile' })).toBeInTheDocument()
        expect(screen.getByText('Used for theme sizes: MD, LG and XL.')).toBeInTheDocument()
        expect(screen.getByText('Used for theme size: SM.')).toBeInTheDocument()
    })

    it('saves edited demo text in the theme draft', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByLabelText('Preview text'), { target: { value: 'A saved preview headline' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save preview content' }))
        await waitFor(() => expect(mocks.savePreviewContent).toHaveBeenCalledWith('7', 'page-main', expect.objectContaining({ 'group:0:element:h1': 'A saved preview headline' }), 2))
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it('saves a theme draft and publishes only after confirmation', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByDisplayValue('32px'), { target: { value: '40px' } })
        await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith('7', expect.objectContaining({ typography: expect.any(Array) })), { timeout: 1500 })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        expect(Object.keys(mocks.save.mock.calls[0][1]).sort()).toEqual(['colors', 'description', 'draftVersion', 'fonts', 'name', 'spacing', 'typography'])
        fireEvent.click(screen.getByRole('button', { name: /publish changes/i }))
        await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith('7', 3))
    })

    it('persists pending theme values before replacing a theme asset', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 4, hasDraftChanges: true })
        const { container } = renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByDisplayValue('32px'), { target: { value: '40px' } })
        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', targetId: 'asset:design:0:hero:md:background', kind: 'asset', label: 'Article hero' },
            source: iframe.contentWindow,
        }))
        await screen.findByRole('button', { name: 'Replace Article hero' })
        const upload = new File(['image'], 'hero.png', { type: 'image/png' })
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [upload] } })
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(mocks.replaceAsset).toHaveBeenCalledWith('7', 'design:0:hero:md:background', upload, 3))
    })

    it('locks element values while a draft save is pending', async () => {
        let finishSave
        mocks.save.mockImplementation(() => new Promise((resolve) => { finishSave = resolve }))
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByDisplayValue('32px'), { target: { value: '40px' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(screen.getByDisplayValue('40px')).toBeDisabled())
        await act(async () => finishSave({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true }))
        await waitFor(() => expect(screen.getByDisplayValue('32px')).not.toBeDisabled())
    })

    it('switches between edit and preview on narrow layouts', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Preview', exact: true }))
        expect(screen.getByTitle('Live theme preview').closest('section')).toHaveClass('flex')
        fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }))
        expect(screen.getByRole('heading', { name: 'Preview content source' }).closest('fieldset')?.parentElement).toHaveClass('flex')
    })
})
