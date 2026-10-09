import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../../test/testUtils'
import LayoutEditor from '../LayoutEditor'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    getDefault: vi.fn(),
    getTheme: vi.fn(),
    listCode: vi.fn(),
    workspace: vi.fn(),
    save: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../../api/themes', () => ({ themesApi: { getDefault: mocks.getDefault, get: mocks.getTheme } }))
vi.mock('../../api/layouts', () => ({ layoutsApi: { codeLayouts: { list: mocks.listCode } } }))
vi.mock('../../api/layoutWorkspaces', () => ({ layoutWorkspacesApi: { workspace: mocks.workspace, save: mocks.save } }))
vi.mock('../help/ContextualHelpLink', () => ({ default: () => null }))

const layouts = {
    schema_version: 1,
    default_layout_key: 'main_layout',
    items: [
        { id: 'main-id', key: 'main_layout', label: 'Main', description: 'Main page layout', status: 'active', slots: { main: {} } },
        { id: 'landing-id', key: 'landing_page', label: 'Landing Page', description: 'Landing page layout', status: 'active', slots: { hero: {}, landing_page: {} } },
        { id: 'error-id', key: 'error_layout', label: 'Error Page', description: 'Shared error page layout', status: 'active', slots: { visual: {}, message: {}, actions: {} } },
    ],
}

describe('LayoutEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getDefault.mockResolvedValue({ id: 18, name: 'eceee', layouts })
        mocks.listCode.mockResolvedValue({ results: [
            { name: 'main_layout', slotConfiguration: { slots: [{ name: 'main' }] } },
            { name: 'landing_page', slotConfiguration: { slots: [{ name: 'landing_page' }] } },
            { name: 'error_layout', slotConfiguration: { slots: [{ name: 'visual', title: 'Illustration', maxWidgets: 1, allowedTypes: ['easy_widgets.ImageWidget'] }, { name: 'message', required: true }, { name: 'actions' }] } },
        ] })
        mocks.save.mockResolvedValue({})
    })

    it('shows the three required theme layouts with both entry actions', async () => {
        const user = userEvent.setup()
        renderWithProviders(<LayoutEditor />)

        expect(await screen.findByRole('heading', { name: 'Main' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Landing Page' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Error Page' })).toBeInTheDocument()
        expect(screen.getAllByText('Theme Layout')).toHaveLength(3)
        expect(screen.getByRole('button', { name: 'Convert Code Layout' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Create Layout' }))
        expect(mocks.navigate).toHaveBeenCalledWith('/settings/themes/18/layouts/editor?action=create')
    })

    it('loads layouts from the selected theme instead of the default theme', async () => {
        mocks.getTheme.mockResolvedValue({ id: 17, name: 'eceeeSummerStudy', layouts })

        renderWithProviders(<LayoutEditor themeId="17" />)

        expect(await screen.findByRole('heading', { name: 'Main' })).toBeInTheDocument()
        expect(mocks.getTheme).toHaveBeenCalledWith('17')
        expect(mocks.getDefault).not.toHaveBeenCalled()
    })

    it('offers to update registered code layouts that already have Theme Layouts', async () => {
        const user = userEvent.setup()
        renderWithProviders(<LayoutEditor />)

        await user.click(await screen.findByRole('button', { name: 'Convert Code Layout' }))
        expect(screen.getByRole('dialog', { name: 'Convert Code Layout' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Update main_layout' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Update landing_page' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Update error_layout' })).toBeEnabled()
    })

    it('updates code-owned slot metadata without replacing Designer structure or custom slot data', async () => {
        const user = userEvent.setup()
        const errorLayout = {
            ...layouts.items[2],
            root: {
                id: 'error-root',
                type: 'semantic',
                tag: 'main',
                label: 'Error page',
                styles: { base: { padding: '30px' } },
                children: [
                    { id: 'visual-node', type: 'slot', slot_key: 'visual', children: [], styles: {}, class_names: [] },
                    { id: 'message-node', type: 'slot', slot_key: 'message', children: [], styles: {}, class_names: [] },
                    { id: 'actions-node', type: 'slot', slot_key: 'actions', children: [], styles: {}, class_names: [] },
                ],
            },
            slots: {
                visual: { label: 'Old visual label', dimensions: { desktop: { width: 880 } }, disallowed_widget_types: ['easy_widgets.ImageWidget'] },
                message: { label: 'Message' },
                actions: { label: 'Actions' },
            },
        }
        mocks.workspace.mockResolvedValue({
            draftVersion: 4,
            layouts: { ...layouts, items: [layouts.items[0], layouts.items[1], errorLayout] },
        })
        renderWithProviders(<LayoutEditor />)

        await user.click(await screen.findByRole('button', { name: 'Convert Code Layout' }))
        await user.click(screen.getByRole('button', { name: 'Update error_layout' }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
        const [themeId, draftVersion, savedDocument] = mocks.save.mock.calls[0]
        const updated = savedDocument.items.find((layout) => layout.key === 'error_layout')
        expect(themeId).toBe(18)
        expect(draftVersion).toBe(4)
        expect(updated.id).toBe('error-id')
        expect(updated.root).toEqual(errorLayout.root)
        expect(updated.slots.visual).toMatchObject({
            label: 'Illustration',
            max_widgets: 1,
            allowed_widget_types: ['easy_widgets.ImageWidget'],
            dimensions: { desktop: { width: 880 } },
        })
        expect(updated.slots.visual.disallowed_widget_types).toBeUndefined()
        expect(updated.slots.message.required).toBe(true)
        expect(mocks.navigate).toHaveBeenCalledWith('/settings/themes/18/layouts/editor?workspace=layouts&layout=error_layout')
    })

    it('wraps a slot root before adding newly registered slots', async () => {
        const user = userEvent.setup()
        const mainRoot = {
            id: 'main-slot-root',
            type: 'slot',
            slot_key: 'main',
            children: [],
            styles: {},
            class_names: ['layout-slot'],
        }
        mocks.listCode.mockResolvedValue({ results: [{
            name: 'main_layout',
            slotConfiguration: { slots: [{ name: 'main' }, { name: 'sidebar' }] },
        }] })
        mocks.workspace.mockResolvedValue({
            draftVersion: 5,
            layouts: { ...layouts, items: [{ ...layouts.items[0], root: mainRoot }, ...layouts.items.slice(1)] },
        })
        renderWithProviders(<LayoutEditor />)

        await user.click(await screen.findByRole('button', { name: 'Convert Code Layout' }))
        await user.click(screen.getByRole('button', { name: 'Update main_layout' }))

        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
        const updated = mocks.save.mock.calls[0][2].items.find((layout) => layout.key === 'main_layout')
        expect(updated.root).toMatchObject({
            type: 'container',
            children: [mainRoot, { type: 'slot', slot_key: 'sidebar', children: [] }],
        })
        expect(updated.root.children[0]).toBe(mainRoot)
    })
})
