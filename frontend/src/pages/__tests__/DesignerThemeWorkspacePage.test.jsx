import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../test/testUtils'
import DesignerThemeWorkspacePage from '../DesignerThemeWorkspacePage'

const mocks = vi.hoisted(() => ({
    workspace: vi.fn(), preview: vi.fn(), save: vi.fn(), publish: vi.fn(), undo: vi.fn(), discard: vi.fn(),
    replaceAsset: vi.fn(), createPlaceholder: vi.fn(), savePreviewContent: vi.fn(), replacePreviewImage: vi.fn(),
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
    spacing: [{ targetId: 'group:0:element:h1', scope: 'element', groupIndex: 0, groupName: 'Article', element: 'h1', values: { marginBottom: '16px' } }],
    assets: [{
        assetKey: 'design:0:hero:md:background', displayName: 'Article hero', kind: 'design-group', usage: ['Article / hero / md / background'],
        requiredWidth: 1600, requiredHeight: 900, requirementSource: 'explicit', dpr: 2, isPlaceholder: true, replaceable: true,
        validation: { status: 'ok', message: 'Explicit dimensions configured.' },
    }],
    canUndo: true,
    previewContent: { views: previewViews },
    catalog: {
        designGroups: [{
            id: 'group:0', groupIndex: 0, label: 'Article', description: 'Editorial content', slots: ['main'],
            elements: [{ id: 'group:0:element:h1', element: 'h1', label: 'Heading 1' }],
            parts: [{ id: 'group:0:part:hero', part: 'hero', label: 'Hero', breakpoints: ['md'] }],
            assetKeys: ['design:0:hero:md:background'], colorNames: ['brand'],
        }],
        componentStyles: [
            { key: 'feature-card', label: 'Feature card', description: 'Highlighted card', template: '<article class="feature-card">{{{content}}}</article>' },
            { key: 'sub-navigation', label: 'Sub navigation', description: '', template: '{{#isInherited}}{{#hasCurrentChildren}}<nav>{{#currentChildren}}<a href="{{path}}">{{title}}</a>{{/currentChildren}}</nav>{{/hasCurrentChildren}}{{/isInherited}}' },
        ],
        layouts: [{
            key: 'main_layout', label: 'Main layout', description: 'Content and sidebar',
            slots: [{ name: 'main', label: 'Main content' }], parts: [], layoutCss: '.main-layout{display:block}',
            previewTemplate: '<div class="main-layout"><main>__DESIGNER_SLOT_main__</main></div>',
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
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('renders real layout previews without exposing internal theme concepts', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        expect(await screen.findByRole('heading', { name: 'Editorial' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Preview views' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Article page' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Article card' })).toBeInTheDocument()
        expect(screen.queryByText('Preview context')).not.toBeInTheDocument()
        expect(screen.queryByText('Design groups')).not.toBeInTheDocument()
        expect(screen.queryByText('Component styles')).not.toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('sandbox', 'allow-scripts')
        await waitFor(() => {
            const source = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
            expect(source).toContain('class="main-layout"')
            expect(source).toContain('data-designer-target="group:0:element:h1"')
            expect(source).toContain('data-designer-kind="previewImage"')
            expect(source).toContain('<nav>')
            expect(source).toContain('First example item')
        })
    })

    it('uses localized default content', async () => {
        document.documentElement.lang = 'sv-SE'
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        const source = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
        expect(source).toContain('En rubrik med verklig längd')
        expect(source).not.toContain('A heading with a realistic length')
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
        expect(screen.getByText('Select something on the page').closest('section')).toHaveClass('flex')
    })
})
