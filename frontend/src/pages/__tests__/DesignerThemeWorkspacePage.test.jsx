import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
        expect(screen.getByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
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
        mocks.replacePreviewImage.mockImplementation(async (_themeId, viewId, _sourceUrl, _image, draftVersion) => ({ ...structuredClone(workspace), draftVersion: draftVersion + 1, hasDraftChanges: true, previewContent: { views: structuredClone(previewViews).map((view) => view.id === viewId ? { ...view, content: { image: { url: 'https://storage.test/theme_images/7/designer_drafts/replaced.jpg' } } } : view) } }))
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
        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'select', targetId: 'content-image:0', kind: 'previewImage', label: 'Imported image', sourceUrl: 'https://storage.test/theme_images/7/library/imported.jpg' },
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
        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'select', targetId: 'content-image:0', kind: 'previewImage', label: 'Imported image', sourceUrl: 'https://storage.test/theme_images/7/library/imported.jpg' },
            source: iframe.contentWindow,
        }))
        const replaceButton = await screen.findByRole('button', { name: 'Replace example image imported.jpg' })
        const upload = new File(['replacement'], 'replacement.png', { type: 'image/png' })

        fireEvent.change(replaceButton.closest('article').querySelector('input[type="file"]'), { target: { files: [upload] } })

        await waitFor(() => expect(mocks.replacePreviewImage).toHaveBeenCalledWith(
            '7',
            'page-imported',
            'https://storage.test/theme_images/7/library/imported.jpg',
            upload,
            3,
        ))
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
        const user = userEvent.setup()
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await user.click(screen.getByRole('tab', { name: 'Your sites' }))

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

    it('collapses and restores both side columns independently', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Collapse preview navigation' })[0])
        expect(screen.getByRole('region', { name: 'Preview navigation' })).toHaveClass('hidden')
        fireEvent.click(screen.getByRole('button', { name: 'Expand preview navigation' }))
        expect(screen.getByRole('region', { name: 'Preview navigation' })).not.toHaveClass('hidden')

        fireEvent.click(screen.getAllByRole('button', { name: 'Collapse theme inspector' })[0])
        expect(screen.getByRole('region', { name: 'Theme inspector' })).toHaveClass('hidden')
        fireEvent.click(screen.getByRole('button', { name: 'Expand theme inspector' }))
        expect(screen.getByRole('region', { name: 'Theme inspector' })).not.toHaveClass('hidden')
    })

    it('offers rich text commands after a preview double-click and lists nested elements as accordions', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
        const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview', action: 'editText', targetId: 'content:0', kind: 'element', label: 'Rich text',
                text: '<p>Editable copy</p>', editable: true, richText: true,
                descendants: [{ id: 'group:0:element:h1', kind: 'element', label: 'Heading 1', text: 'Editable copy', editable: false }],
            },
            source: iframe.contentWindow,
        }))

        expect(screen.getByRole('toolbar', { name: 'Rich text formatting' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'bold' }), '*')
        vi.spyOn(window, 'prompt').mockReturnValue('example.com/article')
        fireEvent.click(screen.getByRole('button', { name: 'Add link' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'createLink', value: 'https://example.com/article' }), '*')
        expect(screen.getByText('Elements inside')).toBeInTheDocument()
        expect(screen.getByText('Heading 1')).toBeInTheDocument()
    })

    it('applies a clicked preview spacing label to the matching inspector row', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'spacingChange', targetIds: ['content:0', 'group:0:element:h1'], property: 'marginBottom', value: '24px' },
            source: iframe.contentWindow,
        }))
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalled())
        expect(mocks.save.mock.calls[0][1].spacing[0].values.marginBottom).toBe('24px')
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

        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'group:0:element:li', kind: 'element', label: 'List item', text: 'Changed nested text' },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('heading', { name: 'List item' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Collapse List item settings' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByLabelText('Example text')).toHaveValue('Changed nested text')
        expect(screen.getByRole('heading', { name: 'Preview content source' })).toBeInTheDocument()
    })

    it('shows editable typography and spacing defaults directly and restores the rendered default when an override is removed', async () => {
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

        expect(screen.getByLabelText('Inner spacing')).toHaveValue('10px')
        expect(screen.getByText('Theme default')).toBeInTheDocument()

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
        expect(screen.getByLabelText('Size')).toBeInTheDocument()
        expect(screen.getByLabelText('Inner spacing')).toBeInTheDocument()
        expect(screen.queryByLabelText('Add theme value')).not.toBeInTheDocument()
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

    it('keeps the preview visible while editing images in the right inspector', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: 'Theme images' }))
        expect(screen.getByRole('heading', { name: 'Theme images' })).toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Select image aspect Article/ }))

        expect(screen.getByRole('button', { name: 'Upload Article hero' })).toBeInTheDocument()
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

    it('keeps the preview visible and shows the responsive image family in the right inspector', async () => {
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
                    alternatives: [
                        { id: 'group:0', kind: 'group', label: 'Article' },
                        { id: 'group:0:part:content-widget', kind: 'part', label: 'Content' },
                        { id: 'asset:design:0:hero:md:background', kind: 'asset', label: 'Article hero' },
                        { id: 'asset:design:0:hero:sm:background', kind: 'asset', label: 'Article hero mobile' },
                    ],
                },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('heading', { name: 'Article hero mobile' })).toBeInTheDocument()
        })

        expect(screen.getByTitle('Live theme preview')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Theme images' })).toHaveClass('text-gray-700')
        expect(screen.getByRole('button', { name: 'Upload Article hero' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Replace Article hero mobile' })).toBeInTheDocument()
        expect(screen.getByText('No file uploaded')).toBeInTheDocument()
        expect(screen.getByText('1600 × 900 px · 2x')).toBeInTheDocument()
        expect(screen.getByText('800 × 600 px · 2x')).toBeInTheDocument()
    })

    it('keeps the selected image family when an inline asset alternative is chosen', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
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
    })

    it('edits and saves visible text only in the selected theme example', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
        const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-frame', action: 'ready' },
            source: iframe.contentWindow,
        }))
        await waitFor(() => expect(postMessage).toHaveBeenCalled())
        postMessage.mockClear()
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', action: 'contentChange', targetId: 'content:0', kind: 'element', label: 'Heading 1 text', text: 'A revised example heading', editable: true },
            source: iframe.contentWindow,
        }))
        expect(screen.getByLabelText('Example text')).toHaveValue('A revised example heading')
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

    it('replaces a theme asset from a preview context action', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true })
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
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

        await waitFor(() => expect(mocks.replaceAsset).toHaveBeenCalledWith(
            '7',
            'design:0:hero:md:background',
            replacement,
            2,
        ))
    })

    it('replaces an example image from a preview context action', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const iframe = screen.getByTitle('Live theme preview')
        const replacement = new File(['photo'], 'photo.webp', { type: 'image/webp' })

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-designer-preview',
                action: 'contextAction',
                command: 'replaceImage',
                targetId: 'content-image:0',
                kind: 'previewImage',
                label: 'Article photo',
                sourceUrl: 'https://storage.test/article-photo.jpg',
                file: replacement,
            },
            source: iframe.contentWindow,
        }))

        await waitFor(() => expect(mocks.replacePreviewImage).toHaveBeenCalledWith(
            '7',
            'page-main',
            'https://storage.test/article-photo.jpg',
            replacement,
            2,
        ))
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
        await screen.findByRole('button', { name: 'Upload Article hero' })
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
        expect(screen.getByRole('region', { name: 'Preview navigation' })).toHaveClass('flex')
        expect(screen.getByRole('region', { name: 'Theme inspector' })).toHaveClass('flex')
    })
})
