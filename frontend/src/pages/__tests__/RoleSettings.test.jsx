import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoleSettings from '../RoleSettings'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

const mocks = vi.hoisted(() => ({ language: 'en-us', get: vi.fn(), patch: vi.fn() }))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ language: mocks.language }) }))
vi.mock('../../components/support/useSupportContext', () => ({ useSupportTenant: () => 'test' }))
vi.mock('../../api/client', () => ({ default: { get: mocks.get, post: vi.fn(), patch: mocks.patch } }))

const renderRoles = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RoleSettings />
    </QueryClientProvider>,
)

describe('role editor language', () => {
    afterEach(() => setCmsCopyLanguage('en-us'))
    beforeEach(() => {
        mocks.language = 'en-us'
        setCmsCopyLanguage('en-us')
        mocks.get.mockResolvedValue({ data: { canManage: true, roles: [], availablePermissions: [], members: [] } })
    })

    it('uses English for the new role heading', async () => {
        renderRoles()
        fireEvent.click(await screen.findByRole('button', { name: 'Create role' }))
        expect(screen.getByRole('heading', { name: 'New role' })).toBeInTheDocument()
    })

    it('uses Swedish for the new role heading', async () => {
        mocks.language = 'sv-se'
        setCmsCopyLanguage('sv-se')
        renderRoles()
        fireEvent.click(await screen.findByRole('button', { name: 'Skapa roll' }))
        expect(screen.getByRole('heading', { name: 'Ny roll' })).toBeInTheDocument()
    })

    it('shows effective permissions and saves a member role assignment', async () => {
        mocks.get.mockResolvedValue({ data: {
            canManage: true, canGrantAdmin: true, availablePermissions: ['page.read'],
            roles: [{ id: 'role-1', name: 'Reader', permissions: ['page.read'], users: [] }],
            members: [{ id: 7, name: 'Alex', roleIds: [], permissions: ['kanban.write'], isOwner: false, isSystemOwner: false }],
        } })
        mocks.patch.mockResolvedValue({ data: { roleIds: ['role-1'] } })
        renderRoles()
        fireEvent.click(await screen.findByText('1 effective permissions'))
        expect(screen.getByText('Kanban · edit')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Edit roles' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Reader' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save roles' }))
        await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/api/v1/utils/roles/', { userId: 7, roleIds: ['role-1'] }))
    })
})
