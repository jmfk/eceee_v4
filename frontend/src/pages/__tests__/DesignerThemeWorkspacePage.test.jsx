import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import DesignerThemeWorkspacePage from '../DesignerThemeWorkspacePage'
import { renderWithStateProviders } from '../../test/testUtils'

const mocks = vi.hoisted(() => ({
    workspace: vi.fn(),
    preview: vi.fn(),
    save: vi.fn(),
    publish: vi.fn(),
    undo: vi.fn(),
    discard: vi.fn(),
    replaceAsset: vi.fn(),
    createPlaceholder: vi.fn(),
    createExport: vi.fn(),
    getExport: vi.fn(),
    getExportDownload: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))
vi.mock('../../components/DesignerNavbar', () => ({ default: () => <div>Designer navigation</div> }))
vi.mock('../../components/StatusBar', () => ({ default: ({ customStatusContent }) => <div>{customStatusContent}</div> }))
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useParams: () => ({ themeId: '7' }) }
})

const workspace = {
    id: 7,
    name: 'Editorial',
    syncVersion: 4,
    liveSyncVersion: 4,
    draftVersion: 2,
    hasDraftChanges: false,
    colors: [{ name: 'brand', value: '#123456', usage: ['Article / h1'] }],
    fonts: [{ family: 'Inter', variants: ['400', '700'], display: 'swap', usage: ['Article / h1'] }],
    typography: [{ targetId: 'group:0:element:h1', groupIndex: 0, groupName: 'Article', element: 'h1', values: { fontFamily: 'Inter', fontSize: '32px' } }],
    spacing: [{ targetId: 'group:0:element:h1', scope: 'element', groupIndex: 0, groupName: 'Article', element: 'h1', values: { marginBottom: '16px' } }],
    assets: [{
        assetKey: 'design:0:hero:md:background',
        displayName: 'Article hero',
        kind: 'design-group',
        usage: ['Article / hero / md / background'],
        requiredWidth: 1600,
        requiredHeight: 900,
        requirementSource: 'explicit',
        dpr: 2,
        isPlaceholder: true,
        replaceable: true,
        validation: { status: 'ok', message: 'Explicit dimensions configured.' },
    }],
    canUndo: true,
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
        layouts: [{ key: 'main_layout', label: 'Main layout', description: 'Content and sidebar', slots: [{ name: 'main', label: 'Main content' }], parts: [] }],
    },
    constraints: {
        editableTypographyProperties: ['fontFamily', 'fontSize'],
        editableSpacingProperties: ['marginBottom', 'padding'],
        maxImageBytes: 10485760,
    },
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
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('renders only the restricted design controls and a sandboxed preview', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        expect(await screen.findByRole('heading', { name: 'Editorial' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Elements' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Colors' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Fonts' })).toBeInTheDocument()
        expect(screen.getByText('Design groups')).toBeInTheDocument()
        expect(screen.getByText('Component styles')).toBeInTheDocument()
        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.queryByText(/custom css/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/selector/i)).not.toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('sandbox', 'allow-scripts')
        await waitFor(() => {
            const preview = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
            expect(preview).toContain('fonts.googleapis.com')
            expect(preview).toContain('data-designer-target="group:0:element:h1"')
            expect(preview).toContain('A heading with a realistic length')
            expect(preview).toContain('Article hero')
        })
        expect(screen.queryByRole('button', { name: /ai sample/i })).not.toBeInTheDocument()
    })

    it('uses localized filler copy for the current document language', async () => {
        document.documentElement.lang = 'sv-SE'
        renderWithStateProviders(<DesignerThemeWorkspacePage />)

        await screen.findByRole('heading', { name: 'Editorial' })
        const preview = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
        expect(preview).toContain('En rubrik med verklig längd')
        expect(preview).not.toContain('A heading with a realistic length')
    })

    it('opens groups and component styles in isolation and exposes clicked element values', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: /Article Editorial content/ }))
        expect(screen.getByRole('heading', { name: 'Article' })).toBeInTheDocument()
        expect(screen.getByLabelText('Design group')).toHaveValue('group:0')
        expect(screen.getByLabelText('Component style')).toBeInTheDocument()

        const iframe = screen.getByTitle('Live theme preview')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-designer-preview', targetId: 'group:0:element:h1', kind: 'element', label: 'Heading 1' },
            source: iframe.contentWindow,
        }))
        expect(screen.getByRole('heading', { name: 'Heading 1' })).toBeInTheDocument()
        expect(screen.getByDisplayValue('32px')).toBeInTheDocument()
        expect(screen.getByDisplayValue('16px')).toBeInTheDocument()
    })

    it('renders component styles that depend on navigation context with localized demo items', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: /Sub navigation Isolated preview/ }))

        const preview = screen.getByTitle('Live theme preview').getAttribute('srcdoc')
        expect(preview).toContain('<nav>')
        expect(preview).toContain('First example item')
        expect(preview).not.toContain('<main class="designer-preview cms-content"></main>')
    })

    it('opens catalog layouts with default rendering after previewing a component style', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: /Feature card Highlighted card/ }))
        expect(screen.getByLabelText('Component style')).toHaveValue('feature-card')
        fireEvent.click(screen.getByRole('button', { name: 'All previews' }))
        fireEvent.click(screen.getByRole('button', { name: /Main layout Content and sidebar/ }))

        expect(screen.getByLabelText('Component style')).toHaveValue('')
        expect(screen.getByText('Layout', { selector: 'p' })).toBeInTheDocument()
    })

    it('saves a draft and publishes it only after explicit confirmation', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Colors' }))
        fireEvent.change(screen.getByLabelText('brand value'), { target: { value: '#abcdef' } })

        await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith('7', expect.objectContaining({ colors: { brand: '#abcdef' } })), { timeout: 1500 })
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        const patch = mocks.save.mock.calls[0][1]
        expect(Object.keys(patch).sort()).toEqual(['colors', 'draftVersion', 'fonts', 'spacing', 'typography'])

        fireEvent.click(screen.getByRole('button', { name: /publish changes/i }))
        await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith('7', 3))
        expect(window.confirm).toHaveBeenCalledWith('Publish every saved Designer draft change to the live theme now?')
    })

    it('restores the latest published revision only when the draft is clean', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })

        fireEvent.click(screen.getByRole('button', { name: /undo publish/i }))

        await waitFor(() => expect(mocks.undo).toHaveBeenCalledWith('7', 2, 4))
        expect(window.confirm).toHaveBeenCalledWith('Restore the theme version from immediately before the latest Designer publish?')
    })

    it('persists pending value edits before staging an asset upload', async () => {
        mocks.replaceAsset.mockResolvedValue({ ...structuredClone(workspace), draftVersion: 4, hasDraftChanges: true })
        const { container } = renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Colors' }))
        fireEvent.change(screen.getByLabelText('brand value'), { target: { value: '#abcdef' } })
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

    it('locks draft controls while a save response is pending', async () => {
        let finishSave
        mocks.save.mockImplementation(() => new Promise((resolve) => { finishSave = resolve }))
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Colors' }))
        fireEvent.change(screen.getByLabelText('brand value'), { target: { value: '#abcdef' } })

        fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

        await waitFor(() => expect(screen.getByLabelText('brand value')).toBeDisabled())
        await act(async () => finishSave({ ...structuredClone(workspace), draftVersion: 3, hasDraftChanges: true }))
        await waitFor(() => expect(screen.getByLabelText('brand value')).not.toBeDisabled())
    })

    it('switches between edit and preview on narrow layouts', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Preview', exact: true }))
        expect(screen.getByTitle('Live theme preview').closest('section')).toHaveClass('flex')
        fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }))
        expect(screen.getByRole('navigation', { name: 'Designer sections' }).closest('section')).toHaveClass('flex')
    })
})
