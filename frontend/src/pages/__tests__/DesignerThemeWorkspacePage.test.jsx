import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import DesignerThemeWorkspacePage from '../DesignerThemeWorkspacePage'
import { renderWithStateProviders } from '../../test/testUtils'

const mocks = vi.hoisted(() => ({
    workspace: vi.fn(),
    preview: vi.fn(),
    save: vi.fn(),
    undo: vi.fn(),
    replaceAsset: vi.fn(),
    createPlaceholder: vi.fn(),
    generatePreviewContent: vi.fn(),
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
    colors: [{ name: 'brand', value: '#123456', usage: ['Article / h1'] }],
    fonts: [{ family: 'Inter', variants: ['400', '700'], display: 'swap', usage: ['Article / h1'] }],
    typography: [{ groupIndex: 0, groupName: 'Article', element: 'h1', values: { fontFamily: 'Inter', fontSize: '32px' } }],
    spacing: [{ scope: 'element', groupIndex: 0, groupName: 'Article', element: 'h1', values: { marginBottom: '16px' } }],
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
        validation: { status: 'ok', message: 'Explicit dimensions configured.' },
    }],
    canUndo: true,
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
        mocks.preview.mockResolvedValue({ css: '.designer-preview{color:#123456}', content: { eyebrow: 'Preview', title: 'Title', lead: 'Lead', cardTitle: 'Card', cardBody: 'Body', listItems: ['One', 'Two', 'Three'] } })
        mocks.save.mockResolvedValue({ ...structuredClone(workspace), syncVersion: 5 })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('renders only the restricted design controls and a sandboxed preview', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        expect(await screen.findByRole('heading', { name: 'Editorial' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Colors' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Typography' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Spacing' })).toBeInTheDocument()
        expect(screen.queryByText(/custom css/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/selector/i)).not.toBeInTheDocument()
        expect(screen.getByTitle('Live theme preview')).toHaveAttribute('sandbox', '')
    })

    it('previews locally and saves only after explicit confirmation', async () => {
        renderWithStateProviders(<DesignerThemeWorkspacePage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Colors' }))
        fireEvent.change(screen.getByLabelText('brand value'), { target: { value: '#abcdef' } })

        await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith('7', expect.objectContaining({ colors: { brand: '#abcdef' } })), { timeout: 1500 })
        fireEvent.click(screen.getByRole('button', { name: /save live changes/i }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
        expect(window.confirm).toHaveBeenCalledWith('Save these changes to the live theme now?')
        const patch = mocks.save.mock.calls[0][1]
        expect(Object.keys(patch).sort()).toEqual(['colors', 'fonts', 'spacing', 'syncVersion', 'typography'])
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
