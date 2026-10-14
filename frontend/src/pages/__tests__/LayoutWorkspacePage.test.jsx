import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LayoutWorkspacePage from '../LayoutWorkspacePage'

const mocks = vi.hoisted(() => ({
    addNotification: vi.fn(),
    navigate: vi.fn(),
    save: vi.fn(),
    workspace: vi.fn(),
}))

vi.mock('../../api/layoutWorkspaces', () => ({
    layoutWorkspacesApi: {
        discard: vi.fn(),
        publish: vi.fn(),
        save: mocks.save,
        workspace: mocks.workspace,
    },
}))
vi.mock('../../components/designer/LayoutDesignerWorkspace', () => ({
    default: ({ updateWorkspace }) => <button type="button" onClick={() => updateWorkspace((draft) => {
        draft.layouts.default_layout_key = 'landing_page'
        return draft
    })}>Change layout</button>,
}))
vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mocks.navigate,
        useParams: () => ({ themeId: '7' }),
        useSearchParams: () => [new URLSearchParams(), vi.fn()],
    }
})

const workspace = {
    draftIsStale: false,
    draftVersion: 2,
    hasLayoutDraftChanges: false,
    hasLayoutWorkspaceDraftChanges: false,
    hasOtherDraftChanges: false,
    layouts: { schema_version: 1, default_layout_key: 'main_layout', items: [] },
    colors: [{ name: 'brand', value: '#123456' }],
    fonts: [{ family: 'Inter', variants: ['400', '700'], display: 'swap' }],
    name: 'Editorial',
}

describe('LayoutWorkspacePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.workspace.mockResolvedValue(structuredClone(workspace))
        mocks.save.mockImplementation(async (_themeId, draftVersion, editableWorkspace) => ({
            ...structuredClone(workspace),
            draftVersion: draftVersion + 1,
            hasLayoutDraftChanges: true,
            hasLayoutWorkspaceDraftChanges: true,
            layouts: structuredClone(editableWorkspace.layouts),
        }))
    })

    it('saves local layout changes before returning to the Theme Designer', async () => {
        render(<LayoutWorkspacePage backPath="/designer/themes/7" backLabel="Theme Designer" />)
        await screen.findByRole('heading', { name: 'Layout Editor' })

        fireEvent.click(screen.getByRole('button', { name: 'Change layout' }))
        fireEvent.click(screen.getByRole('button', { name: 'Theme Designer' }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('7', 2, {
            layouts: {
                schema_version: 1,
                default_layout_key: 'landing_page',
                items: [],
            },
            colors: { brand: '#123456' },
            fonts: [{ family: 'Inter', variants: ['400', '700'], display: 'swap' }],
        }))
        expect(mocks.navigate).toHaveBeenCalledWith('/designer/themes/7')
    })

    it('stays in the Layout Editor when the draft cannot be saved', async () => {
        mocks.save.mockRejectedValue(new Error('Save unavailable'))
        render(<LayoutWorkspacePage backPath="/designer/themes/7" backLabel="Theme Designer" />)
        await screen.findByRole('heading', { name: 'Layout Editor' })

        fireEvent.click(screen.getByRole('button', { name: 'Change layout' }))
        fireEvent.click(screen.getByRole('button', { name: 'Theme Designer' }))

        await waitFor(() => expect(mocks.addNotification).toHaveBeenCalledWith({
            type: 'error',
            message: 'Save unavailable',
        }))
        expect(mocks.navigate).not.toHaveBeenCalled()
    })

    it('blocks global CMS navigation while local layout changes are unsaved', async () => {
        const onCmsNavigationBlockedChange = vi.fn()
        render(<LayoutWorkspacePage onCmsNavigationBlockedChange={onCmsNavigationBlockedChange} />)
        await screen.findByRole('heading', { name: 'Layout Editor' })

        expect(onCmsNavigationBlockedChange).toHaveBeenLastCalledWith(false)
        fireEvent.click(screen.getByRole('button', { name: 'Change layout' }))

        await waitFor(() => expect(onCmsNavigationBlockedChange).toHaveBeenLastCalledWith(true))
    })
})
