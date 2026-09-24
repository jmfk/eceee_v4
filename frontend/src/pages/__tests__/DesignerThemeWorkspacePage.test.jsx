import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../test/testUtils'
import DesignerThemeWorkspacePage from '../DesignerThemeWorkspacePage'

const mocks = vi.hoisted(() => ({
    workspace: vi.fn(), preview: vi.fn(), save: vi.fn(), publish: vi.fn(), undo: vi.fn(), discard: vi.fn(),
    replaceAsset: vi.fn(), createPlaceholder: vi.fn(), savePreviewContent: vi.fn(), replacePreviewImage: vi.fn(),
    importPreviewFromSite: vi.fn(),
    createExport: vi.fn(), getExport: vi.fn(), getExportDownload: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))
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
    id: 7, name: 'Editorial', syncVersion: 4, liveSyncVersion: 4, draftVersion: 2, hasDraftChanges: false,
    colors: [{ name: 'brand', value: '#123456', usage: ['Article / h1'] }],
    fonts: [{ family: 'Inter', variants: ['400', '700'], display: 'swap', usage: ['Article / h1'] }],
    typography: [{ targetId: 'group:0:element:h1', groupIndex: 0, groupName: 'Article', element: 'h1', values: { fontFamily: 'Inter', fontSize: '32px' } }],
    spacing: [
        { targetId: 'group:0:element:h1', scope: 'element', groupIndex: 0, groupName: 'Article', element: 'h1', values: { marginBottom: '16px' } },
        { targetId: 'group:0:part:content-widget', scope: 'layout', groupIndex: 0, groupName: 'Article', part: 'content-widget', breakpoint: 'md', values: { padding: '24px' } },
    ],
    assets: [{
        assetKey: 'preview', displayName: 'Theme preview', filename: 'theme-preview.png', url: 'https://storage.test/theme-preview.png',
        kind: 'preview', usage: ['Theme listing preview'], isPlaceholder: false, replaceable: true,
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
    contentSources: [{ id: 12, label: 'conference.example', hostname: 'conference.example' }],
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
            previewContent: { views: previewViews.map((view) => view.id === viewId ? { ...view, texts } : view) },
        }))
        mocks.replacePreviewImage.mockResolvedValue({ previewContent: { views: previewViews } })
        mocks.importPreviewFromSite.mockResolvedValue({
            previewContent: { views: previewViews.map((view) => ({ ...view, texts: { 'group:0:element:h1': 'Site heading' }, sourceSiteId: 12 })) },
        })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('renders real layout previews without exposing internal theme concepts', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        expect(await screen.findByRole('heading', { name: 'Editorial' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Designer views' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Article page' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Article card' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Theme images' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'What to show' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Page elements' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Layout default' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Appearance' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use Feature card' })).not.toBeInTheDocument()
        expect(screen.queryByText('Preview context')).not.toBeInTheDocument()
        expect(screen.queryByText('Design groups')).not.toBeInTheDocument()
        expect(screen.queryByText('Component styles')).not.toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('sandbox', 'allow-scripts')
        await waitFor(() => {
            const source = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
            const markup = source.split('<script>')[0]
            expect(source).toContain('class="main-layout"')
            expect(source).toContain('data-designer-target="group:0:element:h1"')
            expect(source).toContain('widget-type-easy-widgets-contentwidget')
            expect(source).toContain('widget-type-content')
            expect(source).toContain('demo-part content-widget')
            expect(markup).not.toContain('group:1:element:p')
            expect(source).not.toContain('https://storage.test/theme-preview.png')
            expect(source).not.toContain('class="feature-card"')
            expect(source).toContain('outline:1px dashed rgba(100,116,139,.5)')
            expect(source).toContain('.designer-spacing-margin{border:1px dashed rgba(217,119,6,.65)')
            expect(source).toContain('.designer-spacing-padding{border:1px dashed rgba(8,145,178,.7)')
            expect(source).toContain("addSpacingLabel(readout,'designer-spacing-margin-label','Margin:',own.margin)")
            expect(source).toContain("addSpacingLabel(readout,'designer-spacing-padding-label','Padding:',own.padding)")
            expect(source).toContain("'Container margin:',outer.margin")
            expect(source).toContain("'Container padding:',outer.padding")
            expect(source).toContain('function outermostSpacing(target)')
            expect(source).toContain("document.addEventListener('mouseover'")
            expect(source).not.toContain('.designer-selected::after')
        })
    })

    it('uses a matching published page as the default layout preview', async () => {
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
        const source = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
        expect(source).toContain('Published site heading')
        expect(source).toContain('widget-type-easy-widgets-contentwidget')
        expect(source).toContain("registerTarget(root,{id:group.id,kind:'group'")
        expect(source).toContain("var id='preview:'+viewId+':text:'+index")
        expect(source).toContain("var id='preview:'+viewId+':image:auto:'+index")
        expect(source).toContain('function registerTarget(node,target)')
        expect(source).toContain('[data-designer-target].designer-selected{outline:3px solid #2563eb')
        expect(source).not.toContain('.designer-selected::after')
        expect(source).toContain('.navbar-widget>div:last-child{display:flex!important;position:relative!important;justify-content:space-between!important')
    })

    it('uses localized default content', async () => {
        document.documentElement.lang = 'sv-SE'
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const source = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
        expect(source).toContain('En rubrik med verklig längd')
        expect(source).not.toContain('A heading with a realistic length')
    })

    it('copies published content from a site using the theme into preview content', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        expect(screen.getByLabelText('Demo content from site')).toHaveValue('12')
        fireEvent.click(screen.getByRole('button', { name: 'Use site content' }))
        await waitFor(() => expect(mocks.importPreviewFromSite).toHaveBeenCalledWith('7', 12))
        expect(window.confirm).toHaveBeenCalledWith('Replace saved and unsaved preview content with published content from this site?')
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
        expect(screen.getByRole('heading', { name: 'Preview content' })).toBeInTheDocument()

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
        expect(screen.getByRole('heading', { name: 'Preview content' })).toBeInTheDocument()
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
        fireEvent.click(screen.getByRole('button', { name: 'Bullet list' }))
        expect(screen.getByRole('heading', { name: 'Bullet list' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Preview text')).not.toBeInTheDocument()
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

    it('saves edited demo text as preview content without changing the theme draft', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByLabelText('Preview text'), { target: { value: 'A saved preview headline' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save preview content' }))
        await waitFor(() => expect(mocks.savePreviewContent).toHaveBeenCalledWith('7', 'page-main', expect.objectContaining({ 'group:0:element:h1': 'A saved preview headline' })))
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it('stages a content image locally and uploads it only when preview content is saved', async () => {
        const { container } = renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await waitFor(() => {
            const iframe = screen.getByTitle('Live theme preview')
            fireEvent(window, new MessageEvent('message', {
                data: { source: 'eceee-designer-preview', action: 'select', targetId: 'preview:page-main:image:main', kind: 'previewImage', label: 'Demo content image' },
                source: iframe.contentWindow,
            }))
            expect(screen.getByRole('button', { name: 'Choose preview image' })).toBeInTheDocument()
        })
        const image = new File(['image'], 'content.png', { type: 'image/png' })
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [image] } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save preview content' })).toBeInTheDocument())
        expect(mocks.replacePreviewImage).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Save preview content' }))
        await waitFor(() => expect(mocks.replacePreviewImage).toHaveBeenCalledWith('7', 'page-main', 'preview:page-main:image:main', image))
    })

    it('saves a theme draft and publishes only after confirmation', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        await selectHeading()
        fireEvent.change(screen.getByDisplayValue('32px'), { target: { value: '40px' } })
        await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith('7', expect.objectContaining({ typography: expect.any(Array) })), { timeout: 1500 })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        expect(Object.keys(mocks.save.mock.calls[0][1]).sort()).toEqual(['colors', 'draftVersion', 'fonts', 'spacing', 'typography'])
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
        expect(screen.getByRole('heading', { name: 'Preview content' }).closest('fieldset')?.parentElement).toHaveClass('flex')
    })
})
