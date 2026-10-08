import { screen } from '@testing-library/react'
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
            { name: 'error_layout', slotConfiguration: { slots: [{ name: 'visual' }, { name: 'message' }, { name: 'actions' }] } },
        ] })
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

    it('shows which registered code layouts have already been converted', async () => {
        const user = userEvent.setup()
        renderWithProviders(<LayoutEditor />)

        await user.click(await screen.findByRole('button', { name: 'Convert Code Layout' }))
        expect(screen.getByRole('dialog', { name: 'Convert Code Layout' })).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Converted' })).toHaveLength(3)
    })
})
