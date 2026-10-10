import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../test/testUtils'
import DesignerThemeWorkspacePage from '../DesignerThemeWorkspacePage'

const mocks = vi.hoisted(() => ({
    workspace: vi.fn(), preview: vi.fn(), save: vi.fn(), publish: vi.fn(), undo: vi.fn(), discard: vi.fn(),
    replaceAsset: vi.fn(), createPlaceholder: vi.fn(), savePreviewContent: vi.fn(),
    importPreviewSource: vi.fn(), deletePreviewContent: vi.fn(), replacePreviewImage: vi.fn(),
    loadPreviewPage: vi.fn(), loadPreviewObject: vi.fn(), buildResolvedRenderModel: vi.fn(),
    createExport: vi.fn(), getExport: vi.fn(), getExportDownload: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))
vi.mock('../../rendering/directRender', () => ({ buildResolvedRenderModel: mocks.buildResolvedRenderModel }))
vi.mock('../../components/DesignerNavbar', () => ({ default: () => <div>Designer navigation</div> }))
vi.mock('../../components/StatusBar', () => ({ default: ({ customStatusContent }) => <div>{customStatusContent}</div> }))
vi.mock('../../components/media/MediaSelectModal', () => ({
    default: ({ isOpen, onSelect, namespace, requireTags }) => isOpen ? <div role="dialog" aria-label="Tagged media selector" data-namespace={namespace} data-require-tags={String(requireTags)}><button type="button" onClick={() => onSelect([{ id: 'media-1', title: 'Tagged replacement' }])}>Use tagged replacement</button></div> : null,
}))
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
    mediaNamespace: 'theme-tenant',
    themeConfig: {
        colors: { brand: '#000000' },
        fonts: { googleFonts: [{ family: 'Roboto', variants: ['400'] }] },
        designGroups: { groups: [{ name: 'Article', widgetTypes: ['easy_widgets.ContentWidget'], elements: { h1: {} }, layoutProperties: { 'content-widget': { md: {} } } }] },
    },
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
    }, {
        assetKey: 'library:imported-example.jpg', displayName: 'imported-example.jpg', filename: 'imported-example.jpg',
        url: 'https://storage.test/theme_images/7/library/imported-example.jpg', kind: 'library', usage: ['Unused theme library asset'],
        width: 1200, height: 630, size: 24576, isPlaceholder: false, replaceable: false,
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
        widgetSlots: [{
            widgetType: 'easy_widgets.TwoColumnsWidget', label: 'Two Columns',
            slots: [{ name: 'left', label: 'Left Column' }, { name: 'right', label: 'Right Column' }],
        }],
        previewViews,
    },
    constraints: {
        editableTypographyProperties: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing'],
        editableSpacingProperties: ['marginBottom', 'padding'],
        maxImageBytes: 10485760,
    },
}

const selectHeading = async () => {
    const iframe = await screen.findByTitle('Live theme preview')
    fireEvent(window, new MessageEvent('message', {
        data: { source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:h1', kind: 'element', label: 'Heading 1', text: 'A heading with a realistic length' },
        source: iframe.contentWindow,
    }))
    expect(await screen.findByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
}

const readyPreview = async () => {
    const iframe = await screen.findByTitle('Live theme preview')
    const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')
    fireEvent(window, new MessageEvent('message', {
        data: { source: 'eceee-render-frame', action: 'ready' },
        source: iframe.contentWindow,
    }))
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'eceee-render-host', action: 'render' }),
        '*',
    ))

    return { iframe, postMessage }
}

describe('DesignerThemeWorkspacePage', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.workspace.mockResolvedValue(structuredClone(workspace))
        document.documentElement.lang = 'en'
        mocks.save.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true })
        mocks.publish.mockResolvedValue({ ...structuredClone(workspace), liveSyncVersion: 5, draftVersion: 4 })
        mocks.undo.mockResolvedValue({ ...structuredClone(workspace), liveSyncVersion: 5, draftVersion: 4, canUndo: false })
        mocks.discard.mockResolvedValue(structuredClone(workspace))
        let savedPreviewViews = structuredClone(previewViews)
        mocks.savePreviewContent.mockImplementation(async (_themeId, viewId, texts, draftVersion) => {
            savedPreviewViews = savedPreviewViews.map((view) => view.id === viewId ? { ...view, texts } : view)
            return {
                ...structuredClone(workspace),
                draftVersion: draftVersion + 1,
                hasDraftChanges: true,
                previewContent: { views: structuredClone(savedPreviewViews) },
            }
        })
        mocks.importPreviewSource.mockImplementation(async (_themeId, sourceKind, sourceId, draftVersion) => {
            const imported = {
                id: `${sourceKind}-imported`, label: sourceKind === 'page' ? 'Programme' : 'Welcome article', kind: sourceKind,
                layout: 'main_layout', texts: {}, images: {},
                content: { widgets: { main: [] }, image: { url: 'https://storage.test/theme_images/7/library/imported.jpg' } },
                [sourceKind === 'page' ? 'sourcePageId' : 'sourceObjectId']: sourceId,
            }
            return { ...structuredClone(workspace), draftVersion: draftVersion + 1, hasDraftChanges: true, importedViewId: imported.id, previewContent: { views: [...structuredClone(previewViews), imported] } }
        })
        mocks.deletePreviewContent.mockImplementation(async (_themeId, viewId, draftVersion) => ({ ...structuredClone(workspace), draftVersion: draftVersion + 1, hasDraftChanges: true, previewContent: { views: structuredClone(previewViews).filter((view) => view.id !== viewId) } }))
        mocks.replacePreviewImage.mockImplementation(async (_themeId, viewId, _sourceUrl, _sourcePath, _sourceMatchIndex, _image, draftVersion) => ({ ...structuredClone(workspace), draftVersion: draftVersion + 1, hasDraftChanges: true, previewContent: { views: structuredClone(previewViews).map((view) => view.id === viewId ? { ...view, content: { image: { url: 'https://storage.test/theme_images/7/designer_drafts/replaced.jpg' } } } : view) } }))
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

    it('edits inherited parameters explicitly exposed by a grid layout element', async () => {
        const layoutWorkspace = structuredClone(workspace)
        layoutWorkspace.layouts = {
            schema_version: 1,
            default_layout_key: 'main_layout',
            items: [{
                id: '8ac4db5a-492f-4977-bf00-d21b8d72f08e',
                key: 'main_layout',
                label: 'Main layout',
                status: 'active',
                slots: { main: { label: 'Main content' } },
                root: {
                    id: '2d1ee676-3624-4ec8-aaf4-8874bea037f4',
                    type: 'grid',
                    label: 'Content grid',
                    editable_parameters: ['background_color', 'gap', 'grid_template_columns'],
                    styles: { base: { gap: '30px' }, lg: { grid_template_columns: 'repeat(3, minmax(0, 1fr))' } },
                    children: [{
                        id: '114eff0f-f86f-4a10-8df5-27925804fc73',
                        type: 'slot', slot_key: 'main', children: [], styles: {},
                    }],
                },
            }],
        }
        mocks.workspace.mockResolvedValue(layoutWorkspace)
        mocks.save.mockImplementation(async (_themeId, payload) => ({
            ...structuredClone(layoutWorkspace),
            layouts: structuredClone(payload.layouts),
            draftVersion: 3,
            hasDraftChanges: true,
        }))

        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        const iframe = await screen.findByTitle('Live theme preview')
        await waitFor(() => {
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview', action: 'select',
                    targetId: 'layout-node:2d1ee676-3624-4ec8-aaf4-8874bea037f4',
                    kind: 'element', label: 'Content grid',
                    layoutNodeId: '2d1ee676-3624-4ec8-aaf4-8874bea037f4',
                    editableParameters: ['background_color', 'gap', 'grid_template_columns'],
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('heading', { name: 'Content grid' })).toBeInTheDocument()
        })

        const gap = await screen.findByLabelText('Content grid Gap')
        const columns = screen.getByLabelText('Content grid Grid template columns')
        const background = screen.getByLabelText('Content grid Background color')
        expect(gap).toBeDisabled()
        expect(gap).toHaveValue('30px')
        expect(columns).toBeDisabled()
        expect(columns).toHaveValue('repeat(3, minmax(0, 1fr))')
        expect(background).toBeEnabled()
        expect(background).toHaveValue('')

        fireEvent.click(screen.getByRole('button', { name: 'Override Gap at Extra Large' }))
        expect(gap).toBeEnabled()
        fireEvent.change(gap, { target: { value: '36px' } })
        expect(gap).toHaveValue('36px')
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('7', expect.objectContaining({
            layouts: expect.objectContaining({
                items: [expect.objectContaining({
                    root: expect.objectContaining({
                        styles: expect.objectContaining({ xl: expect.objectContaining({ gap: '36px' }) }),
                    }),
                })],
            }),
        })))
        fireEvent.click(screen.getByRole('button', { name: 'Reset Gap override' }))
        expect(gap).toBeDisabled()
        expect(gap).toHaveValue('30px')
    })

    it('resizes both side panes with dragging and keyboard controls', async () => {
        const originalPointerEvent = window.PointerEvent
        Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent })
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const separator = screen.getByRole('separator', { name: 'Resize preview navigation' })
        const inspectorSeparator = screen.getByRole('separator', { name: 'Resize theme inspector' })
        const workspaceLayout = separator.closest('main')
        vi.spyOn(workspaceLayout, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 0, left: 0, top: 0, right: 1800, bottom: 800, width: 1800, height: 800,
            toJSON: () => ({}),
        })

        expect(separator).toHaveAttribute('aria-valuenow', '360')
        fireEvent.keyDown(separator, { key: 'ArrowRight' })
        expect(separator).toHaveAttribute('aria-valuenow', '376')

        fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 376 })
        fireEvent.pointerMove(separator, { pointerId: 1, clientX: 500 })
        fireEvent.pointerUp(separator, { pointerId: 1, clientX: 500 })

        expect(separator).toHaveAttribute('aria-valuenow', '500')
        expect(workspaceLayout.style.getPropertyValue('--designer-sidebar-width')).toBe('500px')

        fireEvent.keyDown(inspectorSeparator, { key: 'ArrowLeft' })
        expect(inspectorSeparator).toHaveAttribute('aria-valuenow', '396')
        fireEvent.pointerDown(inspectorSeparator, { button: 0, pointerId: 2, clientX: 900 })
        fireEvent.pointerMove(inspectorSeparator, { pointerId: 2, clientX: 800 })
        fireEvent.pointerUp(inspectorSeparator, { pointerId: 2, clientX: 800 })
        expect(inspectorSeparator).toHaveAttribute('aria-valuenow', '496')
        expect(workspaceLayout.style.getPropertyValue('--designer-inspector-width')).toBe('496px')
        Object.defineProperty(window, 'PointerEvent', { configurable: true, value: originalPointerEvent })
    })

    it('reclaims side-pane width when the desktop workspace becomes narrower', async () => {
        const observers = []
        vi.stubGlobal('ResizeObserver', class ResizeObserver {
            constructor(callback) {
                this.callback = callback
                observers.push(this)
            }

            observe(target) { this.target = target }
            disconnect() {}
        })
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const separator = screen.getByRole('separator', { name: 'Resize preview navigation' })
        const inspectorSeparator = screen.getByRole('separator', { name: 'Resize theme inspector' })
        const workspaceLayout = separator.closest('main')
        await waitFor(() => {
            expect(observers.some((observer) => observer.target === workspaceLayout)).toBe(true)
        })
        const workspaceObserver = observers.find((observer) => observer.target === workspaceLayout)
        vi.spyOn(workspaceLayout, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 0, left: 0, top: 0, right: 1800, bottom: 800, width: 1800, height: 800,
            toJSON: () => ({}),
        })
        for (let index = 0; index < 20; index += 1) fireEvent.keyDown(separator, { key: 'ArrowRight' })
        for (let index = 0; index < 24; index += 1) fireEvent.keyDown(inspectorSeparator, { key: 'ArrowLeft' })

        act(() => workspaceObserver.callback([{ contentRect: { width: 1280 } }]))

        const fittedSidebar = Number(separator.getAttribute('aria-valuenow'))
        const fittedInspector = Number(inspectorSeparator.getAttribute('aria-valuenow'))
        expect(fittedSidebar).toBeGreaterThanOrEqual(280)
        expect(fittedInspector).toBeGreaterThanOrEqual(320)
        expect(fittedSidebar + fittedInspector).toBeLessThanOrEqual(784)
        expect(workspaceLayout).toHaveClass('xl:grid-cols-[var(--designer-sidebar-width)_var(--designer-sidebar-handle-width)_minmax(0,1fr)_var(--designer-inspector-handle-width)_var(--designer-inspector-width)]')
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

    it('shows source tabs above Preview pages and searches and filters the demo hierarchy', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const sourceHeading = screen.getByRole('heading', { name: 'Preview content source' })
        const previewPagesHeading = screen.getByRole('heading', { name: 'Preview pages' })
        expect(sourceHeading.compareDocumentPosition(previewPagesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Theme demo' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Your sites' })).toHaveAttribute('aria-selected', 'false')

        const hierarchy = screen.getByRole('list', { name: 'theme demo content hierarchy' })
        expect(within(hierarchy).getByText('Pages')).toBeInTheDocument()
        expect(within(hierarchy).getByText('Objects')).toBeInTheDocument()
        const search = screen.getByLabelText('Search theme demo content')
        await user.type(search, 'Article card')
        await user.click(screen.getByRole('button', { name: 'Select Article card' }))

        expect(screen.getByRole('button', { name: 'Select Article card' })).toHaveAttribute('aria-current', 'true')
        expect(screen.getByRole('button', { name: 'Article card' })).toHaveClass('text-blue-700')

        await user.clear(search)
        await user.selectOptions(screen.getByLabelText('Filter theme demo content'), 'page')
        expect(screen.getByRole('button', { name: 'Select Article page' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Select Article card' })).not.toBeInTheDocument()
    })

    it('can preview a specific page from this tenant independently of its theme', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('tab', { name: 'Your sites' }))
        expect(screen.getByRole('tab', { name: 'Your sites' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('button', { name: 'Select conference.example — Programme' })).toHaveAttribute('aria-current', 'true')
        await waitFor(() => expect(mocks.loadPreviewPage).toHaveBeenCalledWith('7', 42))
        expect(mocks.buildResolvedRenderModel).toHaveBeenCalledWith({
            resolved: expect.objectContaining(workspace.contentPages[0]),
            page: { id: 42 },
            version: { id: 9 },
            rawInheritance: { slots: {} },
        })
        expect(screen.getByRole('button', { name: 'Programme' })).toBeInTheDocument()
        expect(await screen.findByText('The selected content is read-only until it is imported as a theme example.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Import as theme example' })).toBeEnabled()
    })

    it('imports a selected site page as an editable theme example', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await user.click(screen.getByRole('tab', { name: 'Your sites' }))
        const importButton = screen.getByRole('button', { name: 'Import as theme example' })
        await waitFor(() => expect(importButton).toBeEnabled())

        await user.click(importButton)

        await waitFor(() => expect(mocks.importPreviewSource).toHaveBeenCalledWith('7', 'page', 42, 2))
        expect(screen.getByRole('tab', { name: 'Theme demo' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('button', { name: 'Select Programme' })).toHaveAttribute('aria-current', 'true')
        expect(screen.queryByRole('heading', { name: 'Images in this element' })).not.toBeInTheDocument()
        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'select', targetId: 'content-image:0', kind: 'previewImage', label: 'Imported image', sourceUrl: 'https://storage.test/theme_images/7/library/imported.jpg', sourcePath: ['content', 'image', 'url'], sourceMatchIndex: 0 },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('button', { name: 'Replace example image imported.jpg' })).toBeInTheDocument()
    })

    it('deletes a theme example without deleting its source page', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        await user.click(screen.getByRole('button', { name: 'Delete Article page' }))

        expect(window.confirm).toHaveBeenCalledWith('Delete the theme example “Article page”?')
        await waitFor(() => expect(mocks.deletePreviewContent).toHaveBeenCalledWith('7', 'page-main', 2))
        expect(screen.queryByRole('button', { name: 'Select Article page' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Select Article card' })).toHaveAttribute('aria-current', 'true')
    })

    it('replaces an imported image in theme image storage', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await user.click(screen.getByRole('tab', { name: 'Your sites' }))
        const importButton = screen.getByRole('button', { name: 'Import as theme example' })
        await waitFor(() => expect(importButton).toBeEnabled())
        await user.click(importButton)
        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'select', targetId: 'content-image:0', kind: 'previewImage', label: 'Imported image', sourceUrl: 'https://storage.test/theme_images/7/library/imported.jpg', sourcePath: ['content', 'image', 'url'], sourceMatchIndex: 0 },
            source: iframe.contentWindow,
        }))
        const replaceButton = await screen.findByRole('button', { name: 'Replace example image imported.jpg' })
        await user.click(replaceButton)
        const mediaDialog = screen.getByRole('dialog', { name: 'Tagged media selector' })
        expect(mediaDialog).toHaveAttribute('data-namespace', 'theme-tenant')
        expect(mediaDialog).toHaveAttribute('data-require-tags', 'true')
        await user.click(screen.getByRole('button', { name: 'Use tagged replacement' }))

        await waitFor(() => expect(mocks.replacePreviewImage).toHaveBeenCalledWith(
            '7',
            'page-imported',
            'https://storage.test/theme_images/7/library/imported.jpg',
            ['content', 'image', 'url'],
            0,
            { id: 'media-1', title: 'Tagged replacement' },
            3,
        ))
    })

    it('does not offer a cross-tenant media fallback when the workspace has no namespace', async () => {
        const noNamespaceWorkspace = structuredClone(workspace)
        noNamespaceWorkspace.mediaNamespace = null
        noNamespaceWorkspace.previewContent.views[0].content = {
            image: { url: 'https://storage.test/theme_images/7/library/imported.jpg' },
        }
        mocks.workspace.mockResolvedValue(noNamespaceWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'content-image:0',
                kind: 'previewImage', label: 'Imported image',
                sourceUrl: 'https://storage.test/theme_images/7/library/imported.jpg',
                sourcePath: ['content', 'image', 'url'], sourceMatchIndex: 0,
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByRole('button', { name: 'Replace example image imported.jpg' })).toBeDisabled()
        expect(screen.queryByRole('dialog', { name: 'Tagged media selector' })).not.toBeInTheDocument()
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
        await user.click(screen.getByRole('tab', { name: 'Your sites' }))

        expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument()
        const hierarchy = screen.getByRole('list', { name: 'site content hierarchy' })
        expect(within(hierarchy).getByText('conference.example')).toBeInTheDocument()
        expect(within(hierarchy).getByText('Draft site')).toBeInTheDocument()
        const search = screen.getByLabelText('Search site content')
        await user.type(search, 'Draft programme')
        const draftPage = screen.getByRole('button', { name: 'Select Draft site — Draft programme' })
        await waitFor(() => expect(draftPage).not.toBeDisabled())
        await user.click(draftPage)
        await waitFor(() => expect(draftPage).toHaveAttribute('aria-current', 'true'))
        await waitFor(() => expect(search).not.toBeDisabled())
        await user.clear(search)
        await user.type(search, 'Empty page')
        expect(screen.queryByRole('button', { name: /Select .*Empty page/ })).not.toBeInTheDocument()
        await waitFor(() => expect(mocks.loadPreviewPage).toHaveBeenCalledWith('7', 43))
    }, 10000)

    it('lets long navigation labels follow the pane width and exposes the full text on hover', async () => {
        const longTitle = 'Panel 6. Energy-efficient and low-carbon mobility and transport systems'
        const longWorkspace = structuredClone(workspace)
        longWorkspace.contentPages.push({
            id: 46,
            pageId: 46,
            pageTitle: longTitle,
            label: `conference.example — ${longTitle}`,
            siteId: 12,
            siteLabel: 'conference.example',
            tenantIdentifier: 'theme-tenant',
            slugPath: 'panels-and-theme/panel-6',
            versionId: 16,
            versionStatus: 'draft',
            layout: 'main_layout',
        })
        mocks.workspace.mockResolvedValue(longWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await act(async () => {
            fireEvent.click(screen.getByRole('tab', { name: 'Your sites' }))
        })

        const navigationItem = screen.getByRole('button', { name: `Select conference.example — ${longTitle}` })
        const adaptiveLabel = within(navigationItem).getByTitle(longTitle)
        expect(adaptiveLabel).toHaveTextContent(longTitle)
        expect(adaptiveLabel).toHaveClass('min-w-0', 'truncate')
    })

    it('searches and filters objects in the site content hierarchy', async () => {
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await user.click(screen.getByRole('tab', { name: 'Your sites' }))
        await user.selectOptions(screen.getByLabelText('Filter site content'), 'object')
        expect(screen.queryByRole('button', { name: 'Select conference.example — Programme' })).not.toBeInTheDocument()
        const search = screen.getByLabelText('Search site content')
        await user.type(search, 'Welcome article')
        const objectButton = screen.getByRole('button', { name: 'Select Article — Welcome article' })
        await waitFor(() => expect(objectButton).not.toBeDisabled())
        await user.click(objectButton)

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

        expect(screen.getByRole('tab', { name: 'Theme demo' })).toBeDisabled()
        expect(screen.getByRole('tab', { name: 'Your sites' })).toBeDisabled()
        expect(screen.getAllByText('There is no page or object to preview.')).toHaveLength(2)
        expect(screen.queryByTitle('Live theme preview')).not.toBeInTheDocument()
    })

    it('toggles Designer support guides without changing the content source', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { postMessage } = await readyPreview()

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
        postMessage.mockRestore()
    })

    it('collapses and restores both side columns without moving the preview grid column', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        const previewPane = screen.getByTitle('Live theme preview').closest('section')
        const navigationPane = screen.getByRole('region', { name: 'Preview navigation' })
        const inspectorPane = screen.getByRole('region', { name: 'Theme inspector' })
        expect(navigationPane).toHaveClass('xl:col-start-1')
        expect(previewPane).toHaveClass('xl:col-start-3')
        expect(inspectorPane).toHaveClass('xl:col-start-5')

        fireEvent.click(screen.getAllByRole('button', { name: 'Collapse preview navigation' })[0])
        expect(navigationPane).toHaveClass('hidden')
        expect(previewPane).toHaveClass('xl:col-start-3')
        expect(inspectorPane).toHaveClass('xl:col-start-5')
        fireEvent.click(screen.getByRole('button', { name: 'Expand preview navigation' }))
        expect(navigationPane).not.toHaveClass('hidden')

        fireEvent.click(screen.getAllByRole('button', { name: 'Collapse theme inspector' })[0])
        expect(inspectorPane).toHaveClass('hidden')
        expect(previewPane).toHaveClass('xl:col-start-3')
        fireEvent.click(screen.getByRole('button', { name: 'Expand theme inspector' }))
        expect(inspectorPane).not.toHaveClass('hidden')
    })

    it('keeps nested elements as accordions and opens the matching item when preview focus changes', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()

        await waitFor(() => {
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview', action: 'editText', targetId: 'content:0', kind: 'element', label: 'Rich text',
                    text: '<p>Editable copy</p>', editable: true, richText: true,
                    descendants: [
                        { id: 'group:0:element:h1', kind: 'element', label: 'Heading 1', displayLabel: 'Heading 1: “Editable copy”', parentId: 'content:0', depth: 1, text: 'Editable copy', editable: false, widgetId: 'content-1' },
                        { id: 'group:0:element:p', kind: 'element', label: 'Paragraph', displayLabel: 'Paragraph: “More copy”', parentId: 'group:0:element:h1', depth: 2, text: 'More copy', editable: true, widgetId: 'content-1' },
                    ],
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('toolbar', { name: 'Rich text formatting' })).toBeInTheDocument()
        })
        fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'bold' }), '*')
        vi.spyOn(window, 'prompt').mockReturnValue('example.com/article')
        fireEvent.click(screen.getByRole('button', { name: 'Add link' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'createLink', value: 'https://example.com/article' }), '*')
        expect(screen.getByText('Elements inside')).toBeInTheDocument()
        const elementHierarchy = screen.getByRole('tree', { name: 'Element hierarchy' })
        expect(elementHierarchy).toHaveClass('overflow-x-hidden')
        expect(elementHierarchy).not.toHaveClass('overflow-y-auto')
        expect(elementHierarchy.closest('section')).toHaveClass('shrink-0', 'flex-col')
        expect(document.getElementById('selected-element-editor')).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain')
        expect(screen.getByRole('button', { name: 'Edit Paragraph: “More copy”' })).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByRole('treeitem', { name: /Paragraph: “More copy”/ })).toHaveAttribute('aria-level', '2')
        const highlightButton = screen.getByRole('button', { name: 'Highlight Heading 1: “Editable copy”' })
        expect(highlightButton.querySelector('.lucide-focus')).toBeInTheDocument()
        fireEvent.click(highlightButton)
        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host',
            action: 'highlightTarget',
            targetId: 'group:0:element:h1',
            active: true,
            widgetId: 'content-1',
        }, '*')
        expect(screen.getByRole('button', { name: 'Stop highlighting Heading 1: “Editable copy”' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Stop highlighting Heading 1: “Editable copy”' }).querySelector('.lucide-focus')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' }))
        expect(screen.getByRole('heading', { name: 'Heading 1: “Editable copy”' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Highlight Heading 1: “Editable copy”' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByRole('region', { name: 'Heading 1 settings' })).toHaveClass('designer-inspector-focus')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-render-host',
            action: 'selectTarget',
            targetId: 'group:0:element:h1',
            widgetId: 'content-1',
        }), '*')
        fireEvent.click(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' }))
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByRole('region', { name: 'Heading 1 settings' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' }))
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('region', { name: 'Heading 1 settings' })).toBeInTheDocument()
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:h1',
                kind: 'element', label: 'Heading 1', text: 'Editable copy', editable: false, widgetId: 'content-1',
            },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('button', { name: 'Edit Paragraph: “More copy”' })).toBeInTheDocument()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:p',
                kind: 'element', label: 'Paragraph', text: 'More copy', editable: true, widgetId: 'content-1',
            },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('button', { name: 'Edit Heading 1: “Editable copy”' })).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByRole('button', { name: 'Edit Paragraph: “More copy”' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('button', { name: 'Edit Paragraph: “More copy”' })).toHaveAttribute('aria-pressed', 'true')
        const firstParagraphPanel = screen.getByRole('region', { name: 'Paragraph settings' })

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:p',
                kind: 'element', label: 'Paragraph', text: 'More copy', editable: true, widgetId: 'content-1',
            },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('region', { name: 'Paragraph settings' })).not.toBe(firstParagraphPanel)
        expect(screen.getByRole('heading', { name: 'Paragraph' })).toBeInTheDocument()
    })

    it('keeps repeated element targets separate for each widget instance', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'layout:main_layout:slot:main', kind: 'layoutSlot', label: 'Main content',
                descendants: [
                    { id: 'widget:first', kind: 'widget', label: 'First content', parentId: 'layout:main_layout:slot:main', depth: 1, widgetId: 'first' },
                    { id: 'paragraph', kind: 'element', label: 'Paragraph', displayLabel: 'Paragraph: “First copy”', parentId: 'widget:first', parentWidgetId: 'first', depth: 2, widgetId: 'first' },
                    { id: 'widget:second', kind: 'widget', label: 'Second content', parentId: 'layout:main_layout:slot:main', depth: 1, widgetId: 'second' },
                    { id: 'paragraph', kind: 'element', label: 'Paragraph', displayLabel: 'Paragraph: “Second copy”', parentId: 'widget:second', parentWidgetId: 'second', depth: 2, widgetId: 'second' },
                ],
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByRole('treeitem', { name: 'Paragraph: “First copy”' })).toBeInTheDocument()
        const secondParagraph = await screen.findByRole('button', { name: 'Edit Paragraph: “Second copy”' })
        fireEvent.click(secondParagraph)

        expect(screen.getByRole('button', { name: 'Edit Paragraph: “Second copy”' })).toHaveAttribute('aria-pressed', 'true')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-render-host', action: 'selectTarget',
            targetId: 'paragraph', widgetId: 'second',
            selectionLevel: 'element',
        }), '*')
    })

    it('identifies layout slots separately from selected elements', async () => {
        const layoutSlotWorkspace = structuredClone(workspace)
        layoutSlotWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        layoutSlotWorkspace.catalog.layouts[0].slots.find((slot) => slot.name === 'hero').editableSpacingProperties = ['paddingTop']
        mocks.workspace.mockResolvedValue(layoutSlotWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        await waitFor(() => {
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview', action: 'select', targetId: 'layout:main_layout:slot:hero',
                    kind: 'layoutSlot', label: 'Hero', editable: false,
                    computedStyles: { paddingTop: '12px' },
                    descendants: [{
                        id: 'group:0:element:h1', kind: 'element', label: 'Heading 1',
                        displayLabel: 'Heading 1: “Example headline”', parentId: 'layout:main_layout:slot:hero',
                        depth: 1, text: 'Example headline', editable: false,
                    }],
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByText('Selected slot')).toBeInTheDocument()
        })
        expect(screen.getByRole('heading', { name: 'Hero' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Collapse selected slot Hero' })).toBeInTheDocument()
        fireEvent.change(await screen.findByLabelText('slot Padding top'), { target: { value: '20px' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scope: 'layoutSlot', layout: 'main_layout', slot: 'hero',
                breakpoint: 'xl', values: { paddingTop: '20px' },
            }),
        ]))

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'group:0:element:h1',
                kind: 'element', label: 'Heading 1', text: 'Example headline', editable: false,
            },
            source: iframe.contentWindow,
        }))

        expect(screen.getByText('Selected element')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Collapse selected element Heading 1' })).toBeInTheDocument()
    })

    it('keeps layout slots informative when the layout exposes no editable spacing', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'layout:main_layout:slot:main', styleTargetId: 'layout:main_layout:slot:main',
                kind: 'layoutSlot', label: 'Main Content', computedStyles: { paddingTop: '30px' },
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByRole('heading', { name: 'Main Content' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /selected slot Main Content/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '+ Add spacing' })).not.toBeInTheDocument()
        expect(screen.queryByLabelText('slot Padding top')).not.toBeInTheDocument()
    })

    it('identifies widget selections separately from slots and elements', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        await waitFor(() => {
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview', action: 'select', targetId: 'widget:banner-1',
                    kind: 'widget', label: 'Banner widget', widgetId: 'banner-1',
                    widgetType: 'easy_widgets.BannerWidget', editable: false,
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByText('Selected widget')).toBeInTheDocument()
        })
        expect(screen.getByRole('heading', { name: 'Banner widget' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /selected widget Banner widget/i })).not.toBeInTheDocument()
    })

    it('creates responsive spacing for a selected nested widget slot', async () => {
        const widgetSlotWorkspace = structuredClone(workspace)
        widgetSlotWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        widgetSlotWorkspace.catalog.widgetSlots[0].slots[0].editableSpacingProperties = ['paddingTop']
        mocks.workspace.mockResolvedValue(widgetSlotWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'slot:columns-1:left', styleTargetId: 'widget-slot:easy_widgets.TwoColumnsWidget:left',
                kind: 'slot', label: 'Left slot', widgetId: 'columns-1', widgetType: 'easy_widgets.TwoColumnsWidget',
                computedStyles: { marginBottom: '0px', padding: '0px' },
            },
            source: iframe.contentWindow,
        }))

        expect(screen.queryByRole('button', { name: '+ Add spacing' })).not.toBeInTheDocument()
        fireEvent.change(await screen.findByLabelText('slot Padding top'), { target: { value: '24px' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scope: 'widgetSlot', widgetType: 'easy_widgets.TwoColumnsWidget', slot: 'left',
                breakpoint: 'xl', values: expect.objectContaining({ paddingTop: '24px' }),
            }),
        ]))
    })

    it('creates the first responsive spacing rule for a layout slot from inline editing', async () => {
        const layoutSlotWorkspace = structuredClone(workspace)
        layoutSlotWorkspace.catalog.layouts[0].slots.find((slot) => slot.name === 'main').editableSpacingProperties = ['padding']
        mocks.workspace.mockResolvedValue(layoutSlotWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'layout:main_layout:slot:main', styleTargetId: 'layout:main_layout:slot:main',
                kind: 'layoutSlot', label: 'Main content', computedStyles: { padding: '0px' },
            },
            source: iframe.contentWindow,
        }))
        expect(await screen.findByLabelText('slot Inner spacing')).toHaveValue('0px')
        expect(screen.queryByRole('button', { name: '+ Add spacing' })).not.toBeInTheDocument()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'spacingChange',
                targetIds: ['layout:main_layout:slot:main'], property: 'padding', value: '28px',
            },
            source: iframe.contentWindow,
        }))
        await waitFor(() => expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scope: 'layoutSlot', layout: 'main_layout', slot: 'main',
                breakpoint: 'xl', values: expect.objectContaining({ padding: '28px' }),
            }),
        ]))
    })

    it('shows and creates the first responsive margin override for any selected widget', async () => {
        const widgetWorkspace = structuredClone(workspace)
        widgetWorkspace.spacing = []
        widgetWorkspace.constraints.editableSpacingProperties = ['marginTop', 'paddingTop']
        mocks.workspace.mockResolvedValue(widgetWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:header-1', styleTargetId: 'widget-type:easy_widgets.HeaderWidget',
                kind: 'widget', widgetType: 'easy_widgets.HeaderWidget', label: 'Header widget',
                computedStyles: { marginTop: '30px', paddingTop: '16px' },
            },
            source: iframe.contentWindow,
        }))
        expect(await screen.findByLabelText('widget Margin top')).toHaveValue('30px')
        expect(screen.getByLabelText('widget Padding top')).toHaveValue('16px')

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'spacingChange',
                targetId: 'widget-type:easy_widgets.HeaderWidget',
                targetIds: ['widget:header-1', 'widget-type:easy_widgets.HeaderWidget'],
                property: 'marginTop', value: '36px',
            },
            source: iframe.contentWindow,
        }))
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scope: 'widget',
                widgetType: 'easy_widgets.HeaderWidget', breakpoint: 'xl',
                values: { marginTop: '36px' },
            }),
        ]))
    })

    it('shows design-group properties directly below a selected element row', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'group:0:element:h1', kind: 'element', label: 'Heading 1', editable: false,
                computedStyles: { fontFamily: 'Inter', fontSize: '32px', marginBottom: '16px' },
            },
            source: iframe.contentWindow,
        }))

        const selectedPanel = await screen.findByRole('button', { name: 'Collapse selected element Heading 1' })
        const panel = document.getElementById(selectedPanel.getAttribute('aria-controls'))
        expect(within(panel).getByRole('heading', { name: 'Typography · Heading 1' })).toBeInTheDocument()
        expect(within(panel).getByDisplayValue('Inter')).toBeInTheDocument()
        expect(within(panel).getByDisplayValue('32px')).toBeInTheDocument()
        expect(within(panel).getByLabelText('element Margin bottom')).toHaveValue('16px')
    })

    it('shows only meaningful computed spacing controls for a selected widget', async () => {
        const compactSpacingWorkspace = structuredClone(workspace)
        compactSpacingWorkspace.constraints.editableSpacingProperties = [
            'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
            'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        ]
        compactSpacingWorkspace.spacing = [{
            targetId: 'group:0:part:content-widget', scope: 'layout', groupIndex: 0, groupName: 'Article',
            part: 'content-widget', breakpoint: 'md',
            values: { marginRight: '40px', marginLeft: '40px', padding: '30px' },
        }]
        mocks.workspace.mockResolvedValue(compactSpacingWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'group:0:part:content-widget',
                kind: 'part', label: 'Content widget', widgetId: 'content-1', widgetType: 'easy_widgets.ContentWidget',
                computedStyles: {
                    margin: '0px 40px', marginTop: '0px', marginRight: '40px', marginBottom: '0px', marginLeft: '40px',
                    padding: '30px', paddingTop: '30px', paddingRight: '30px', paddingBottom: '30px', paddingLeft: '30px',
                },
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByLabelText('widget Margin right')).toHaveValue('40px')
        expect(screen.getByLabelText('widget Margin left')).toHaveValue('40px')
        expect(screen.getByLabelText('widget Padding top')).toHaveValue('30px')
        expect(screen.getByLabelText('widget Padding right')).toHaveValue('30px')
        expect(screen.getByLabelText('widget Padding bottom')).toHaveValue('30px')
        expect(screen.getByLabelText('widget Padding left')).toHaveValue('30px')
        expect(screen.getByLabelText('widget Padding top').parentElement).toHaveClass('col-start-2', 'row-start-1')
        expect(screen.getByLabelText('widget Padding right').parentElement).toHaveClass('col-start-3', 'row-start-2')
        expect(screen.getByLabelText('widget Padding bottom').parentElement).toHaveClass('col-start-2', 'row-start-3')
        expect(screen.getByLabelText('widget Padding left').parentElement).toHaveClass('col-start-1', 'row-start-2')
        expect(screen.getByLabelText('widget Margin right').parentElement).toHaveClass('col-start-3', 'row-start-2')
        expect(screen.getByLabelText('widget Margin left').parentElement).toHaveClass('col-start-1', 'row-start-2')
        expect(screen.queryByLabelText('widget Outer spacing')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('widget Inner spacing')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('widget Margin top')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('widget Margin bottom')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Show all margin and padding sides' })).not.toBeInTheDocument()
    })

    it.each([
        {
            widgetName: 'Two Columns', widgetType: 'easy_widgets.TwoColumnsWidget',
            part: 'two-columns-widget', label: 'Two Columns container',
        },
        {
            widgetName: 'Three Columns', widgetType: 'easy_widgets.ThreeColumnsWidget',
            part: 'three-columns-widget', label: 'Three Columns container',
        },
    ])('creates the first $widgetName gap override at the widget level', async ({ widgetName, widgetType, part, label }) => {
        const columnWorkspace = structuredClone(workspace)
        columnWorkspace.constraints.editableSpacingProperties.push('gap')
        columnWorkspace.catalog.designGroups[0].parts = [{
            id: `group:0:part:${part}`, part, label,
            editableSpacingProperties: ['gap'],
        }]
        columnWorkspace.spacing = columnWorkspace.spacing.filter((row) => row.targetId !== `group:0:part:${part}`)
        mocks.workspace.mockResolvedValue(columnWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:columns-1', styleTargetId: `widget-type:${widgetType}`,
                kind: 'widget', label: `${widgetName} widget`,
                widgetId: 'columns-1', widgetType, computedStyles: { paddingLeft: '100px' },
                configurationSpacingTargets: [{
                    id: `group:0:part:${part}`, styleTargetId: `group:0:part:${part}`,
                    kind: 'part', label, widgetId: 'columns-1', widgetType,
                    computedStyles: { gap: '30px' },
                }],
                selectionPaths: {
                    slot: [],
                    widget: [{
                        id: 'widget:columns-1', styleTargetId: `widget-type:${widgetType}`,
                        kind: 'widget', label: `${widgetName} widget`, widgetId: 'columns-1', widgetType,
                        computedStyles: { paddingLeft: '100px' },
                        configurationSpacingTargets: [{
                            id: `group:0:part:${part}`, styleTargetId: `group:0:part:${part}`,
                            kind: 'part', label, widgetId: 'columns-1', widgetType,
                            computedStyles: { gap: '30px' },
                        }],
                    }],
                    element: [],
                },
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByLabelText('widget Column gap')).toHaveValue('30px')
        fireEvent.change(screen.getByLabelText('widget Column gap'), { target: { value: '36px' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scope: 'layout', groupIndex: 0, part, breakpoint: 'xl', values: { gap: '36px' },
            }),
        ]))
    })

    it('shows spacing from the selected instance when semantic targets are reused', async () => {
        const reusedTargetWorkspace = structuredClone(workspace)
        reusedTargetWorkspace.constraints.editableSpacingProperties = [
            'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        ]
        reusedTargetWorkspace.spacing[0].values.marginTop = '16px'
        mocks.workspace.mockResolvedValue(reusedTargetWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'group:0:element:h1', kind: 'element', label: 'Hero heading', widgetId: 'hero-1',
                computedStyles: { marginTop: '16px', marginBottom: '16px' },
                alternatives: [{
                    id: 'group:0:element:h1', kind: 'element', label: 'Another heading', widgetId: 'content-1',
                    computedStyles: { marginTop: '24px', marginBottom: '18px' },
                }],
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByLabelText('element Margin top')).toHaveValue('16px')
        expect(screen.getByLabelText('element Margin bottom')).toHaveValue('16px')
    })

    it('applies a clicked preview spacing label to the nearest target and active breakpoint', async () => {
        const responsiveWorkspace = structuredClone(workspace)
        responsiveWorkspace.spacing = [
            responsiveWorkspace.spacing[0],
            { ...responsiveWorkspace.spacing[1], breakpoint: 'xs', values: { padding: '8px' } },
            { ...responsiveWorkspace.spacing[1], breakpoint: 'md', values: { marginBottom: '16px', padding: '24px' } },
        ]
        mocks.workspace.mockResolvedValue(responsiveWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()
        await waitFor(() => {
            fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview', action: 'spacingChange',
                    targetIds: ['group:0:part:content-widget', 'group:0:element:h1'],
                    property: 'padding', value: '32px', viewportWidth: 1280,
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled()
        })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing[0].values.padding).toBeUndefined()
        expect(mocks.save.mock.calls[0][1].spacing[1].values.padding).toBe('8px')
        expect(mocks.save.mock.calls[0][1].spacing[2].values.padding).toBe('24px')
        expect(mocks.save.mock.calls[0][1].spacing[3]).toEqual(expect.objectContaining({ breakpoint: 'xl', values: { padding: '32px' } }))
    })

    it('ignores inline spacing changes for widget parts not exposed by the theme', async () => {
        const widgetPartWorkspace = structuredClone(workspace)
        widgetPartWorkspace.spacing = widgetPartWorkspace.spacing.filter((row) => !row.targetId.startsWith('widget-part:'))
        widgetPartWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        mocks.workspace.mockResolvedValue(widgetPartWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'spacingChange',
                targetIds: ['widget-part:easy_widgets.HeroWidget:hero-content', 'group:0:element:h1'],
                property: 'paddingTop', value: '34px', viewportWidth: 1280,
            },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled()
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it('creates first widget-slot spacing from the inline preview editor', async () => {
        const widgetSlotWorkspace = structuredClone(workspace)
        widgetSlotWorkspace.spacing = widgetSlotWorkspace.spacing.filter((row) => row.scope !== 'widgetSlot')
        widgetSlotWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        widgetSlotWorkspace.catalog.widgetSlots[0].slots[0].editableSpacingProperties = ['paddingTop']
        mocks.workspace.mockResolvedValue(widgetSlotWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'spacingChange',
                targetId: 'widget-slot:easy_widgets.TwoColumnsWidget:left',
                targetIds: ['slot:columns-1:left', 'widget-slot:easy_widgets.TwoColumnsWidget:left'],
                property: 'paddingTop', value: '28px', viewportWidth: 1280,
            },
            source: iframe.contentWindow,
        }))
        await waitFor(() => expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scope: 'widgetSlot', widgetType: 'easy_widgets.TwoColumnsWidget', slot: 'left',
                breakpoint: 'xl', values: { paddingTop: '28px' },
            }),
        ]))
    })

    it('does not offer widget-part spacing that the theme does not expose', async () => {
        const widgetPartWorkspace = structuredClone(workspace)
        widgetPartWorkspace.spacing = widgetPartWorkspace.spacing.filter((row) => !row.targetId.startsWith('widget-part:'))
        widgetPartWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        mocks.workspace.mockResolvedValue(widgetPartWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget-part:easy_widgets.HeroWidget:hero-content',
                styleTargetId: 'widget-part:easy_widgets.HeroWidget:hero-content',
                kind: 'element', label: 'Hero content', widgetId: 'hero-1', widgetType: 'easy_widgets.HeroWidget',
                computedStyles: { paddingTop: '17px' },
            },
            source: iframe.contentWindow,
        }))

        expect(screen.queryByLabelText('Padding top')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '+ Add spacing' })).not.toBeInTheDocument()
    })

    it('keeps an inline element spacing change on the exact element instead of its widget-part ancestor', async () => {
        const exactTargetWorkspace = structuredClone(workspace)
        exactTargetWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        mocks.workspace.mockResolvedValue(exactTargetWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'spacingChange',
                targetId: 'group:0:element:h1',
                targetIds: ['group:0:element:h1', 'widget-part:easy_widgets.ContentWidget:content-widget'],
                property: 'marginBottom', value: '20px', viewportWidth: 1280,
            },
            source: iframe.contentWindow,
        }))
        await waitFor(() => expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        const savedSpacing = mocks.save.mock.calls[0][1].spacing
        expect(savedSpacing.find((row) => row.scope === 'element' && row.groupIndex === 0 && row.element === 'h1').values.marginBottom).toBe('20px')
        expect(savedSpacing.some((row) => row.scope === 'widgetPart' && row.widgetType === 'easy_widgets.ContentWidget')).toBe(false)
    })

    it('creates an active-breakpoint override when inherited structural spacing is edited', async () => {
        const inheritedWorkspace = structuredClone(workspace)
        inheritedWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        inheritedWorkspace.spacing.push({
            targetId: 'widget-type:easy_widgets.HeroWidget', scope: 'widget',
            widgetType: 'easy_widgets.HeroWidget', values: { paddingTop: '8px' },
        })
        inheritedWorkspace.spacing.push({
            targetId: 'widget-type:easy_widgets.HeroWidget', scope: 'widget',
            widgetType: 'easy_widgets.HeroWidget', breakpoint: 'md', values: { paddingTop: '24px' },
        })
        mocks.workspace.mockResolvedValue(inheritedWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:hero-1', styleTargetId: 'widget-type:easy_widgets.HeroWidget',
                kind: 'widget', label: 'Hero widget', widgetId: 'hero-1', widgetType: 'easy_widgets.HeroWidget',
                computedStyles: { paddingTop: '24px' },
            },
            source: iframe.contentWindow,
        }))

        fireEvent.change(await screen.findByLabelText('widget Padding top'), { target: { value: '32px' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        const savedSpacing = mocks.save.mock.calls[0][1].spacing
        expect(savedSpacing.find((row) => row.scope === 'widget' && row.widgetType === 'easy_widgets.HeroWidget' && !row.breakpoint).values.paddingTop).toBe('8px')
        expect(savedSpacing.find((row) => row.scope === 'widget' && row.widgetType === 'easy_widgets.HeroWidget' && row.breakpoint === 'md').values.paddingTop).toBe('24px')
        expect(savedSpacing.find((row) => row.scope === 'widget' && row.widgetType === 'easy_widgets.HeroWidget' && row.breakpoint === 'xl').values.paddingTop).toBe('32px')
    })

    it('edits an inherited responsive shorthand instead of a hidden global direction', async () => {
        const inheritedWorkspace = structuredClone(workspace)
        inheritedWorkspace.constraints.editableSpacingProperties.push('paddingLeft')
        inheritedWorkspace.spacing.push({
            targetId: 'widget-type:easy_widgets.HeroWidget', scope: 'widget',
            widgetType: 'easy_widgets.HeroWidget', values: { paddingLeft: '40px' },
        }, {
            targetId: 'widget-type:easy_widgets.HeroWidget', scope: 'widget',
            widgetType: 'easy_widgets.HeroWidget', breakpoint: 'md', values: { padding: '24px' },
        })
        mocks.workspace.mockResolvedValue(inheritedWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:hero-1', styleTargetId: 'widget-type:easy_widgets.HeroWidget',
                kind: 'widget', label: 'Hero widget', widgetId: 'hero-1', widgetType: 'easy_widgets.HeroWidget',
                computedStyles: { paddingLeft: '24px' },
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByLabelText('widget Padding left')).toHaveValue('24px')
        fireEvent.change(screen.getByLabelText('widget Padding left'), { target: { value: '32px' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        const savedSpacing = mocks.save.mock.calls[0][1].spacing
        expect(savedSpacing.find((row) => row.widgetType === 'easy_widgets.HeroWidget' && !row.breakpoint).values.paddingLeft).toBe('40px')
        expect(savedSpacing.find((row) => row.widgetType === 'easy_widgets.HeroWidget' && row.breakpoint === 'md').values.padding).toBe('24px')
        expect(savedSpacing.find((row) => row.widgetType === 'easy_widgets.HeroWidget' && row.breakpoint === 'xl').values.paddingLeft).toBe('32px')
    })

    it('edits the canonical breakpoint when legacy and canonical rows share a width', async () => {
        const responsiveWorkspace = structuredClone(workspace)
        responsiveWorkspace.spacing = [
            responsiveWorkspace.spacing[0],
            { ...responsiveWorkspace.spacing[1], breakpoint: 'desktop', values: { padding: '12px' } },
            { ...responsiveWorkspace.spacing[1], breakpoint: 'sm', values: { padding: '16px' } },
        ]
        mocks.workspace.mockResolvedValue(responsiveWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Small (Mobile) preview at 640px' }))
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'spacingChange',
                targetIds: ['group:0:part:content-widget'],
                property: 'padding', value: '32px', viewportWidth: 640,
            },
            source: iframe.contentWindow,
        }))
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        const savedSpacing = mocks.save.mock.calls[0][1].spacing
        expect(savedSpacing.find((row) => row.breakpoint === 'desktop').values.padding).toBe('12px')
        expect(savedSpacing.find((row) => row.breakpoint === 'sm').values.padding).toBe('32px')
    })

    it('does not show an inherited directional value overridden by a later shorthand', async () => {
        const responsiveWorkspace = structuredClone(workspace)
        responsiveWorkspace.spacing = [
            responsiveWorkspace.spacing[0],
            { ...responsiveWorkspace.spacing[1], breakpoint: 'md', values: { paddingLeft: '40px' } },
            { ...responsiveWorkspace.spacing[1], breakpoint: 'xl', values: { padding: '10px' } },
        ]
        mocks.workspace.mockResolvedValue(responsiveWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'group:0:part:content-widget', kind: 'part', label: 'Content',
                computedStyles: { paddingLeft: '10px' },
            },
            source: iframe.contentWindow,
        }))
        expect(await screen.findByDisplayValue('10px')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('40px')).not.toBeInTheDocument()
    })

    it('uses every theme level, including Base, as a global preview selector', async () => {
        const responsiveWorkspace = structuredClone(workspace)
        responsiveWorkspace.breakpoints = { xs: 0, sm: 600, md: 820, lg: 1100, xl: 1440 }
        mocks.workspace.mockResolvedValue(responsiveWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        expect(screen.getByRole('button', { name: 'Small (Mobile) preview at 600px' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Base (Mobile) preview at 375px' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Medium (Tablet) preview at 820px' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Large (Desktop) preview at 1100px' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Extra Large preview at 1440px' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTitle('Live theme preview')).toHaveStyle({ width: '1440px' })

        fireEvent.click(screen.getByRole('button', { name: 'Base (Mobile) preview at 375px' }))

        expect(screen.getByTitle('Live theme preview')).toHaveStyle({ width: '375px' })
        expect(screen.getByText('Base (Mobile) · 375px')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Base (Mobile) preview at 375px' })).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(screen.getByRole('button', { name: 'Small (Mobile) preview at 600px' }))

        expect(screen.getByTitle('Live theme preview')).toHaveStyle({ width: '600px' })
        expect(screen.getByText('Small (Mobile) · 600px')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Small (Mobile) preview at 600px' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('keeps legacy breakpoint spacing and images available at their canonical levels', async () => {
        const legacyWorkspace = structuredClone(workspace)
        legacyWorkspace.spacing = [
            legacyWorkspace.spacing[0],
            { ...legacyWorkspace.spacing[1], breakpoint: 'mobile', values: { padding: '12px' } },
        ]
        legacyWorkspace.assets = [
            ...legacyWorkspace.assets.filter((asset) => !asset.assetKey.startsWith('design:0:hero:')),
            {
                ...legacyWorkspace.assets.find((asset) => asset.assetKey === 'design:0:hero:sm:background'),
                assetKey: 'design:0:hero:mobile:background',
                breakpoint: 'mobile',
            },
        ]
        mocks.workspace.mockResolvedValue(legacyWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', targetId: 'group:0:part:content-widget', kind: 'part', label: 'Content' },
            source: iframe.contentWindow,
        }))
        expect(await screen.findByText(/defined at Base \(Mobile\)/i)).toBeInTheDocument()
        expect(screen.getByDisplayValue('12px')).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Theme images' }))
        fireEvent.click(screen.getByRole('button', { name: /Select image aspect Article/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Change to Base (Mobile)' }))
        expect(screen.getByRole('button', { name: 'Replace Article hero mobile source at Base (Mobile)' })).toBeInTheDocument()
    })

    it('shows only relevant values after clicking a visible element', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        expect(screen.getByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Preview text')).not.toBeInTheDocument()
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

        const { iframe } = await readyPreview()
        await waitFor(() => {
            fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'group:0:element:li', kind: 'element', label: 'List item', text: 'Changed nested text' },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('heading', { name: 'List item' })).toBeInTheDocument()
        })
        expect(screen.getByRole('button', { name: 'Collapse List item settings' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByLabelText('Example text')).toHaveValue('Changed nested text')
        expect(screen.getByRole('heading', { name: 'Preview content source' })).toBeInTheDocument()
    })

    it('shows editable typography and spacing defaults directly and restores the rendered default when an override is removed', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select', targetId: 'content:99', kind: 'element', label: 'Heading 1 text', text: 'Heading', editable: true,
                computedStyles: { fontSize: '18px', padding: '10px' },
                ancestors: [{
                    id: 'group:0:element:h1', kind: 'element', label: 'Heading 1', editable: false,
                    computedStyles: { fontSize: '18px', fontWeight: '700', lineHeight: '1.2', padding: '10px' },
                }],
            },
            source: iframe.contentWindow,
        }))
        expect(await screen.findByLabelText('Inner spacing')).toHaveValue('10px')
        expect(screen.getByLabelText('Weight')).toHaveValue('700')
        expect(screen.getByLabelText('Line height')).toHaveValue('1.2')
        expect(screen.getAllByText('Theme default').length).toBeGreaterThan(0)

        fireEvent.click(screen.getByRole('button', { name: 'Remove Size' }))
        expect(window.confirm).toHaveBeenCalledWith('Remove Size? It will use the current theme default instead.')
        expect(screen.getByLabelText('Size')).toHaveValue('18px')
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        expect(mocks.save.mock.calls[0][1].typography[0].values.fontSize).toBe('')
    })

    it('keeps typography and spacing groups editable when every value uses the theme default', async () => {
        const defaultOnlyWorkspace = structuredClone(workspace)
        defaultOnlyWorkspace.typography[0].values = { fontFamily: '', fontSize: '' }
        defaultOnlyWorkspace.spacing[0].values = { marginBottom: '', padding: '' }
        mocks.workspace.mockResolvedValue(defaultOnlyWorkspace)

        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()

        expect(screen.getByRole('heading', { name: /Typography/ })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /^Spacing/ })).toBeInTheDocument()
        expect(screen.getByLabelText('Font family')).toBeInTheDocument()
        expect(screen.getByLabelText('Size')).toBeInTheDocument()
        expect(screen.getByLabelText('Weight')).toBeInTheDocument()
        expect(screen.getByLabelText('Style')).toBeInTheDocument()
        expect(screen.getByLabelText('Line height')).toBeInTheDocument()
        expect(screen.getByLabelText('Letter spacing')).toBeInTheDocument()
        expect(screen.getByLabelText('Inner spacing')).toBeInTheDocument()
        expect(screen.queryByLabelText('Add theme value')).not.toBeInTheDocument()
        expect(screen.getByLabelText('Font family').closest('div')?.parentElement).toHaveClass('grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]')
        expect(screen.getByRole('region', { name: 'Theme inspector' }).querySelector('fieldset')).toHaveClass('min-w-0', 'overflow-x-hidden')
    })

    it('shows the nested element path as a clickable breadcrumb', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview',
                    targetId: 'group:0:element:a',
                    kind: 'element',
                    label: 'Link',
                    text: 'Programme',
                    editable: true,
                    path: [
                        { id: 'group:0:element:ul', kind: 'element', label: 'Bullet list', text: 'Programme\nPanels', editable: false },
                        { id: 'group:0:element:li', kind: 'element', label: 'List item', text: 'Programme', editable: true },
                        { id: 'group:0:element:a', kind: 'element', label: 'Link', text: 'Programme', editable: true },
                    ],
                    alternatives: [
                        { id: 'group:0:element:a', kind: 'element', label: 'Link', text: 'Programme', editable: true },
                        { id: 'group:0:element:li', kind: 'element', label: 'List item', text: 'Programme', editable: true },
                        { id: 'group:0:element:ul', kind: 'element', label: 'Bullet list', text: 'Programme\nPanels', editable: false },
                    ],
                },
                source: iframe.contentWindow,
        }))
        await screen.findByRole('navigation', { name: 'Element path' })

        const elementPath = screen.getByRole('navigation', { name: 'Element path' })
        expect(within(elementPath).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Bullet list', 'List item', 'Link'])
        expect(within(elementPath).getByText('Link')).toHaveAttribute('aria-current', 'page')
        expect(within(elementPath).getByRole('button', { name: 'List item' })).toBeInTheDocument()
        fireEvent.click(within(elementPath).getByRole('button', { name: 'Bullet list' }))
        expect(screen.getByRole('heading', { name: 'Bullet list' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Preview text')).not.toBeInTheDocument()
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-render-host',
            action: 'selectTarget',
            targetId: 'group:0:element:ul',
        }), '*')
    })

    it('keeps repeated targets inside one widget as separate selectable DOM instances', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:content-1', targetInstanceId: 'node:root', kind: 'widget',
                label: 'Content widget', widgetId: 'content-1',
                descendants: [
                    {
                        id: 'paragraph', instanceId: 'node:first', kind: 'element', label: 'Paragraph',
                        displayLabel: 'Paragraph: “First paragraph”', widgetId: 'content-1',
                        parentId: 'widget:content-1', parentInstanceId: 'node:root', parentWidgetId: 'content-1',
                    },
                    {
                        id: 'paragraph', instanceId: 'node:second', kind: 'element', label: 'Paragraph',
                        displayLabel: 'Paragraph: “Second paragraph”', widgetId: 'content-1',
                        parentId: 'widget:content-1', parentInstanceId: 'node:root', parentWidgetId: 'content-1',
                    },
                ],
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByRole('treeitem', { name: 'Paragraph: “First paragraph”' })).toBeInTheDocument()
        expect(screen.getByRole('treeitem', { name: 'Paragraph: “Second paragraph”' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Edit Paragraph: “Second paragraph”' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-render-host', action: 'selectTarget', targetId: 'paragraph',
            targetInstanceId: 'node:second', widgetId: 'content-1',
        }), '*')
    })

    it('shows one navigable widget and slot trail while preserving the original selection', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview', action: 'select',
                    targetId: 'group:0:element:h1', kind: 'element', label: 'Heading', widgetId: 'headline-1',
                    path: [
                        { id: 'layout:main_layout:slot:main', kind: 'layoutSlot', label: 'Main content' },
                        { id: 'widget:columns-1', kind: 'widget', label: 'Two columns widget', widgetId: 'columns-1' },
                        {
                            id: 'slot:columns-1:left', styleTargetId: 'widget-slot:easy_widgets.TwoColumnsWidget:left',
                            kind: 'slot', label: 'Left slot', widgetId: 'columns-1', widgetType: 'easy_widgets.TwoColumnsWidget',
                        },
                        { id: 'widget:headline-1', kind: 'widget', label: 'Headline widget', widgetId: 'headline-1' },
                        { id: 'group:0:element:h1', kind: 'element', label: 'Heading', widgetId: 'headline-1' },
                    ],
                    selectionPaths: {
                        slot: [
                            { id: 'layout:main_layout:slot:main', kind: 'layoutSlot', label: 'Main content' },
                            {
                                id: 'slot:columns-1:left', styleTargetId: 'widget-slot:easy_widgets.TwoColumnsWidget:left',
                                kind: 'slot', label: 'Left slot', widgetId: 'columns-1', widgetType: 'easy_widgets.TwoColumnsWidget',
                            },
                        ],
                        widget: [
                            { id: 'widget:columns-1', kind: 'widget', label: 'Two columns widget', widgetId: 'columns-1' },
                            {
                                id: 'widget:headline-1', kind: 'widget', label: 'Headline widget', widgetId: 'headline-1',
                                widgetType: 'easy_widgets.ContentWidget',
                            },
                        ],
                        element: [
                            { id: 'article', kind: 'group', label: 'Article', widgetId: 'headline-1' },
                            { id: 'group:0:element:h1', kind: 'element', label: 'Heading', widgetId: 'headline-1' },
                        ],
                    },
                },
                source: iframe.contentWindow,
        }))
        await screen.findByRole('navigation', { name: 'Widget and slot path' })

        const trail = screen.getByRole('navigation', { name: 'Widget and slot path' })
        expect(within(trail).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            'Main content', 'Two columns widget', 'Left slot', 'Headline widget',
        ])
        expect(within(trail).getByRole('button', { name: 'Headline widget' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('heading', { name: 'Left slot' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Headline widget' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Collapse selected slot Left slot' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Collapse selected widget Headline widget' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Collapse selected element Heading' })).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(within(trail).getByRole('button', { name: 'Two columns widget' }))
        expect(within(trail).getByRole('button', { name: 'Headline widget' })).toHaveAttribute('aria-current', 'page')
        expect(within(trail).getByRole('button', { name: 'Two columns widget' })).toHaveAttribute('aria-pressed', 'true')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-render-host', action: 'selectTarget', targetId: 'widget:columns-1',
            selectionLevel: 'widget',
            selectedTargets: expect.arrayContaining([
                expect.objectContaining({ targetId: 'slot:columns-1:left', selectionLevel: 'slot' }),
                expect.objectContaining({ targetId: 'widget:columns-1', selectionLevel: 'widget' }),
                expect.objectContaining({ targetId: 'group:0:element:h1', selectionLevel: 'element' }),
            ]),
        }), '*')

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:navbar-1', kind: 'widget', label: 'Navbar widget container', widgetId: 'navbar-1',
                selectionPaths: {
                    slot: [
                        { id: 'layout:main_layout:slot:navigation', kind: 'layoutSlot', label: 'Navigation Bar' },
                    ],
                    widget: [
                        { id: 'widget:navbar-1', kind: 'widget', label: 'Navbar widget container', widgetId: 'navbar-1' },
                    ],
                    element: [],
                },
            },
            source: iframe.contentWindow,
        }))

        expect(screen.getByRole('heading', { name: 'Navigation Bar' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Navbar widget container' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Collapse selected element Heading' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Expand selected element Heading' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Expand selected slot Navigation Bar' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Collapse selected slot Navigation Bar' })).not.toBeInTheDocument()
        expect(screen.queryByText('Layout placement only. This slot does not provide editable spacing.')).not.toBeInTheDocument()
    })

    it('clears the preview target when the content source changes', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'group:0:element:h1', kind: 'element', label: 'Heading 1', widgetId: 'content-1',
            },
            source: iframe.contentWindow,
        }))
        postMessage.mockClear()

        fireEvent.click(screen.getByRole('button', { name: 'Select Article card' }))

        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host', action: 'clearTarget',
        }, '*')
        expect(screen.queryByText('Selected element')).not.toBeInTheDocument()
    })

    it('hides technical alternatives that all have the same user-facing name', async () => {
        const duplicatedWorkspace = structuredClone(workspace)
        duplicatedWorkspace.catalog.designGroups[0].parts[0].label = 'Content widget container'
        duplicatedWorkspace.catalog.designGroups.push(
            {
                ...structuredClone(duplicatedWorkspace.catalog.designGroups[0]),
                id: 'group:2', groupIndex: 2, label: 'Secondary content',
                parts: [{ id: 'group:2:part:content-widget', part: 'content-widget', label: 'Content widget container', breakpoints: ['md'] }],
            },
        )
        duplicatedWorkspace.spacing.push(
            { targetId: 'group:1:part:content-widget', scope: 'layout', groupIndex: 1, groupName: 'Callout', part: 'content-widget', breakpoint: 'md', values: { padding: '20px' } },
            { targetId: 'group:2:part:content-widget', scope: 'layout', groupIndex: 2, groupName: 'Secondary content', part: 'content-widget', breakpoint: 'md', values: { padding: '28px' } },
        )
        mocks.workspace.mockResolvedValue(duplicatedWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()
        fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview',
                    action: 'select',
                    targetId: 'group:0:part:content-widget',
                    kind: 'part',
                    label: 'Content widget container',
                    widgetId: 'content-1',
                    selectionPaths: {
                        slot: [],
                        widget: [
                            { id: 'widget:content-1', kind: 'widget', label: 'Content widget', widgetId: 'content-1' },
                            { id: 'group:0:part:content-widget', kind: 'part', label: 'Content widget container', widgetId: 'content-1' },
                        ],
                        element: [],
                    },
                    alternatives: [
                        { id: 'group:0:part:content-widget', kind: 'part', label: 'Content widget container' },
                        { id: 'group:1:part:content-widget', kind: 'part', label: 'Content widget container' },
                        { id: 'group:2:part:content-widget', kind: 'part', label: 'Content widget container' },
                    ],
                },
                source: iframe.contentWindow,
        }))
        await screen.findByRole('heading', { name: 'Content area' })

        expect(screen.queryByRole('heading', { name: 'Choose what to edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Content widget container' })).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Widget ancestors path' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Content widget' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '+ Add spacing' })).not.toBeInTheDocument()
    })

    it('shows theme colors in the selected level without opening the image library', async () => {
        const propertyWorkspace = structuredClone(workspace)
        propertyWorkspace.spacing[1].values.marginBottom = '16px'
        mocks.workspace.mockResolvedValue(propertyWorkspace)
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', targetId: 'group:0', kind: 'group', label: 'Article' },
                source: iframe.contentWindow,
        }))
        await screen.findByRole('heading', { name: 'Article' })

        expect(screen.queryByRole('heading', { name: 'Theme images' })).not.toBeInTheDocument()
        expect(screen.getByLabelText('brand value')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('brand value'), { target: { value: '#abcdef' } })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].colors).toEqual(expect.objectContaining({ brand: '#abcdef' }))
    })

    it('shows widget images and colors at the selected widget level', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:hero-1', kind: 'widget', label: 'Hero widget',
                widgetId: 'hero-1', widgetType: 'easy_widgets.HeroWidget',
                alternatives: [
                    { id: 'widget:hero-1', kind: 'widget', label: 'Hero widget', widgetId: 'hero-1' },
                    { id: 'group:0', kind: 'group', label: 'Article', widgetId: 'hero-1' },
                    { id: 'asset:design:0:hero:md:background', kind: 'asset', label: 'Article hero', widgetId: 'hero-1' },
                ],
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByRole('button', { name: 'Change to Medium (Tablet)' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Upload Article hero source at Medium (Tablet)' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add Article hero image here for Extra Large' })).toHaveTextContent('Add image here')
        expect(screen.getByLabelText('brand value')).toHaveValue('#123456')

        fireEvent.click(screen.getByRole('button', { name: 'Change to Medium (Tablet)' }))
        expect(screen.getByRole('button', { name: 'Medium (Tablet) preview at 768px' })).toHaveAttribute('aria-pressed', 'true')
        expect(await screen.findByRole('button', { name: 'Upload Article hero source at Medium (Tablet)' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add Article hero image here for Extra Large' })).not.toBeInTheDocument()
    })

    it('keeps the preview visible while editing images in the right inspector', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true })
        mocks.createPlaceholder.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true })
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: 'Theme images' }))
        expect(screen.getByRole('heading', { name: 'Theme images' })).toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Select image aspect Article/ }))

        expect(screen.getByRole('button', { name: 'Change to Medium (Tablet)' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Upload Article hero source at Medium (Tablet)' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Replace Article hero mobile source at Small (Mobile)' })).not.toBeInTheDocument()
        expect(screen.getByText('Used for theme sizes: MD, LG and XL.')).toBeInTheDocument()
        expect(screen.getByText('Shown from 768 px wide and up.')).toBeInTheDocument()
        expect(screen.queryByText('Used for theme size: SM.')).not.toBeInTheDocument()
        expect(screen.queryByText('Shown from 640 px to 767 px wide.')).not.toBeInTheDocument()

        expect(screen.queryByRole('button', { name: 'Create Article hero source placeholder at Medium (Tablet)' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Create Extra Large placeholder override for Article hero' }))
        await waitFor(() => expect(mocks.createPlaceholder).toHaveBeenCalledWith('7', {
            assetKey: 'design:0:hero:md:background',
            displayName: 'Article hero',
            width: 1600,
            height: 900,
            draftVersion: 2,
            targetBreakpoint: 'xl',
        }))

        const override = new File(['xl'], 'hero-xl.png', { type: 'image/png' })
        fireEvent.change(screen.getByLabelText('New Extra Large image override for Article hero'), { target: { files: [override] } })
        await waitFor(() => expect(mocks.replaceAsset).toHaveBeenCalledWith('7', 'design:0:hero:md:background', override, 3, 'xl'))

        fireEvent.click(screen.getByRole('button', { name: /Select image aspect Callout/ }))
        expect(screen.getByText('All sizes')).toBeInTheDocument()
        expect(screen.getByText('Used for all theme sizes: XS, SM, MD, LG and XL.')).toBeInTheDocument()
        expect(screen.getByText('Shown at every screen width.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Change to Base (Mobile)' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Replace Callout background source at Base (Mobile)' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Change to Base (Mobile)' }))
        expect(screen.getByRole('button', { name: 'Base (Mobile) preview at 375px' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Replace Callout background source at Base (Mobile)' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Select image aspect imported-example.jpg' }))
        expect(screen.getByText('1200 × 630 px · 24 KB')).toBeInTheDocument()
        expect(screen.getByText(/Stored in the theme image library/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Replace imported-example.jpg' })).not.toBeInTheDocument()
    })

    it('edits theme identity and uploads preview and favicon images from Theme details', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 4, hasDraftChanges: true })
        const { container } = renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: 'Theme details' }))
        expect(screen.getByRole('heading', { name: 'Theme details' })).toBeInTheDocument()
        const nameInput = screen.getByRole('textbox', { name: /^Name/ })
        fireEvent.change(nameInput, { target: { value: 'Editorial 2027' } })
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A renewed editorial theme' } })
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

    it('keeps the preview visible and shows only the active responsive image in the right inspector', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Small (Mobile) preview at 640px' }))

        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
                data: {
                    source: 'eceee-designer-preview',
                    targetId: 'asset:design:0:hero:sm:background',
                    kind: 'asset',
                    label: 'Article hero mobile',
                    alternatives: [
                        { id: 'group:0', kind: 'group', label: 'Article' },
                        { id: 'group:0:part:content-widget', kind: 'part', label: 'Content' },
                        { id: 'asset:design:0:hero:md:background', kind: 'asset', label: 'Article hero' },
                        { id: 'asset:design:0:hero:sm:background', kind: 'asset', label: 'Article hero mobile' },
                    ],
                },
                source: iframe.contentWindow,
        }))
        await screen.findByRole('heading', { name: 'Article hero mobile' })

        expect(screen.getByTitle('Live theme preview')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Theme images' })).toHaveClass('text-gray-700')
        expect(screen.queryByRole('button', { name: 'Upload Article hero source at Medium (Tablet)' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Replace Article hero mobile source at Small (Mobile)' })).toBeInTheDocument()
        expect(screen.queryByText('No file uploaded')).not.toBeInTheDocument()
        expect(screen.queryByText('1600 × 900 px · 2x')).not.toBeInTheDocument()
        expect(screen.getByText('800 × 600 px · 2x')).toBeInTheDocument()
    })

    it('keeps the selected image family when an inline asset alternative is chosen', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview',
                targetId: 'group:1',
                kind: 'group',
                label: 'Callout',
                alternatives: [
                    { id: 'group:1', kind: 'group', label: 'Callout' },
                    { id: 'asset:design:1:menu:xs:background', kind: 'asset', label: 'Callout background' },
                ],
            },
            source: iframe.contentWindow,
        }))

        fireEvent.click(await screen.findByRole('button', { name: 'Select Callout background' }))
        expect(screen.getByRole('button', { name: 'Select Callout background' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Theme images' }))
        expect(screen.getByRole('heading', { name: 'Callout' })).toBeInTheDocument()
        postMessage.mockRestore()
    })

    it('edits and saves visible text only in the selected theme example', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockClear()
        fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'content:0', kind: 'element', label: 'Heading 1 text', text: 'A revised example heading', editable: true },
                source: iframe.contentWindow,
        }))
        await waitFor(() => expect(screen.getByLabelText('Example text')).toHaveValue('A revised example heading'))
        expect(postMessage).not.toHaveBeenCalled()
        fireEvent.change(screen.getByLabelText('Example text'), { target: { value: 'Inspector heading' } })
        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host', action: 'updateText', targetId: 'content:0', text: 'Inspector heading',
        }, '*')
        fireEvent.click(screen.getByRole('button', { name: 'Save example text' }))
        await waitFor(() => expect(mocks.savePreviewContent).toHaveBeenCalledWith(
            '7',
            'page-main',
            { 'content:0': 'Inspector heading' },
            2,
        ))
        expect(mocks.save).not.toHaveBeenCalled()
        postMessage.mockRestore()
    })

    it('includes inline example text in the global draft lifecycle', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()

        fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'content:0', kind: 'element', label: 'Heading 1 text', text: 'Pending heading', editable: true },
                source: iframe.contentWindow,
        }))
        await screen.findByText('Unsaved local draft changes')
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Discard draft' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Publish changes' })).toBeEnabled()

        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
        await waitFor(() => expect(mocks.savePreviewContent).toHaveBeenCalledWith(
            '7',
            'page-main',
            { 'content:0': 'Pending heading' },
            2,
        ))
        expect(mocks.save).not.toHaveBeenCalled()
        expect(await screen.findByText('Draft saved · not published')).toBeInTheDocument()
    })

    it('keeps pending example text when the preview model is rebuilt', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()

        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'content:0', kind: 'element', label: 'Heading 1 text', text: 'Pending across views', editable: true },
            source: iframe.contentWindow,
        }))
        postMessage.mockClear()

        fireEvent.click(screen.getByRole('button', { name: 'Select Article card' }))
        fireEvent.click(screen.getByRole('button', { name: 'Select Article page' }))

        await waitFor(() => {
            const renderCalls = postMessage.mock.calls.filter(([message]) => message?.action === 'render')
            expect(renderCalls.at(-1)?.[0].model.designer.texts).toEqual({ 'content:0': 'Pending across views' })
        })
        postMessage.mockRestore()
    })

    it('clears pending example text when the draft is discarded', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()

        fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'content:0', kind: 'element', label: 'Heading 1 text', text: 'Discard me', editable: true },
                source: iframe.contentWindow,
        }))
        await waitFor(() => expect(screen.getByLabelText('Example text')).toHaveValue('Discard me'))

        fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }))
        await waitFor(() => expect(mocks.discard).toHaveBeenCalledWith('7', 2))
        expect(await screen.findByText('Draft matches the live theme')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
        await waitFor(() => expect(screen.queryByLabelText('Example text')).not.toBeInTheDocument())
    })

    it('does not save selected example text twice when theme settings are also dirty', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByDisplayValue('32px'), { target: { value: '40px' } })
        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'content:0', kind: 'element', label: 'Heading 1 text', text: 'One write only', editable: true },
                source: iframe.contentWindow,
        }))
        await waitFor(() => expect(screen.getByLabelText('Example text')).toHaveValue('One write only'))

        fireEvent.click(screen.getByRole('button', { name: 'Save example text' }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(mocks.savePreviewContent).toHaveBeenCalledTimes(1))
        expect(mocks.savePreviewContent).toHaveBeenCalledWith(
            '7',
            'page-main',
            { 'content:0': 'One write only' },
            3,
        )
    })

    it('opens a theme asset context action in the inspector without replacing it', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()
        const replacement = new File(['hero'], 'hero.png', { type: 'image/png' })

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview',
                action: 'contextAction',
                command: 'replaceImage',
                targetId: 'asset:design:0:hero:md:background',
                kind: 'asset',
                label: 'Article hero',
                file: replacement,
            },
            source: iframe.contentWindow,
        }))

        expect(await screen.findByRole('heading', { name: 'Article hero' })).toBeInTheDocument()
        expect(mocks.replaceAsset).not.toHaveBeenCalled()
    })

    it('replaces an example image from a preview context action', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe, postMessage } = await readyPreview()
        postMessage.mockRestore()
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview',
                action: 'contextAction',
                command: 'replaceImage',
                targetId: 'content-image:0',
                kind: 'previewImage',
                label: 'Article photo',
                sourceUrl: 'https://storage.test/article-photo.jpg',
                sourcePath: ['content', 'widgets', 'main', 0, 'config', 'imageUrl'],
                sourceMatchIndex: 0,
            },
            source: iframe.contentWindow,
        }))
        fireEvent.click(await screen.findByRole('button', { name: 'Use tagged replacement' }))

        await waitFor(() => expect(mocks.replacePreviewImage).toHaveBeenCalledWith(
            '7',
            'page-main',
            'https://storage.test/article-photo.jpg',
            ['content', 'widgets', 'main', 0, 'config', 'imageUrl'],
            0,
            { id: 'media-1', title: 'Tagged replacement' },
            2,
        ))
    })

    it('saves a theme draft and publishes only after confirmation', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByDisplayValue('32px'), { target: { value: '40px' } })
        expect(mocks.preview).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        expect(Object.keys(mocks.save.mock.calls[0][1]).sort()).toEqual(['colors', 'description', 'draftVersion', 'fonts', 'name', 'spacing', 'typography'])
        fireEvent.click(screen.getByRole('button', { name: /publish changes/i }))
        await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith('7', 3))
    })

    it('persists pending theme values before replacing a theme asset', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 4, hasDraftChanges: true })
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const { iframe } = await readyPreview()
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'select',
                targetId: 'widget:hero-1', kind: 'widget', label: 'Hero widget',
                widgetId: 'hero-1', widgetType: 'easy_widgets.HeroWidget',
                alternatives: [
                    { id: 'widget:hero-1', kind: 'widget', label: 'Hero widget', widgetId: 'hero-1' },
                    { id: 'group:0', kind: 'group', label: 'Article', widgetId: 'hero-1' },
                    { id: 'asset:design:0:hero:md:background', kind: 'asset', label: 'Article hero', widgetId: 'hero-1' },
                ],
            },
            source: iframe.contentWindow,
        }))
        fireEvent.change(await screen.findByLabelText('brand value'), { target: { value: '#abcdef' } })
        fireEvent.click(await screen.findByRole('button', { name: 'Change to Medium (Tablet)' }))
        await screen.findByRole('button', { name: 'Upload Article hero source at Medium (Tablet)' })
        const upload = new File(['image'], 'hero.png', { type: 'image/png' })
        fireEvent.change(screen.getByLabelText('New source image for Article hero at Medium (Tablet)'), { target: { files: [upload] } })
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
        expect(screen.getByRole('region', { name: 'Preview navigation' })).toHaveClass('flex')
        expect(screen.getByRole('region', { name: 'Theme inspector' })).toHaveClass('flex')
    })
})
