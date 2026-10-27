import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoleSettings from '../RoleSettings'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

const mocks = vi.hoisted(() => ({ language: 'en-us', user: null, get: vi.fn(), patch: vi.fn() }))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ language: mocks.language, user: mocks.user }) }))
vi.mock('../../components/support/useSupportContext', () => ({ useSupportTenant: () => 'test' }))
vi.mock('../../api/client', () => ({ default: { get: mocks.get, post: vi.fn(), patch: mocks.patch } }))

const renderRoles = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><RoleSettings /></MemoryRouter>
    </QueryClientProvider>,
)

describe('role editor language', () => {
    afterEach(() => setCmsCopyLanguage('en-us'))
    beforeEach(() => {
        mocks.language = 'en-us'
        mocks.user = null
        setCmsCopyLanguage('en-us')
        mocks.get.mockResolvedValue({ data: { canManage: true, roles: [], availablePermissions: [], members: [] } })
    })

    it('uses English for the new role heading', async () => {
        renderRoles()
        fireEvent.click(await screen.findByRole('button', { name: 'Create role' }))
        expect(mocks.get).toHaveBeenCalledWith('/api/v1/utils/roles/', { headers: { 'X-Tenant-ID': 'test' } })
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
        await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/api/v1/utils/roles/', { userId: 7, roleIds: ['role-1'] }, { headers: { 'X-Tenant-ID': 'test' } }))
    })

    it('offers only active accounts when adding a workspace member', async () => {
        mocks.user = { isSuperuser: true }
        mocks.get.mockImplementation((path) => Promise.resolve({ data: path.endsWith('/users/')
            ? { users: [{ id: 1, username: 'Active account', isActive: true }, { id: 2, username: 'Inactive account', isActive: false }] }
            : { canManage: true, canGrantAdmin: true, roles: [], availablePermissions: [], members: [] } }))
        renderRoles()

        fireEvent.click(await screen.findByRole('button', { name: 'Add existing account' }))
        fireEvent.click(screen.getByRole('combobox', { name: 'System account' }))
        expect(await screen.findByRole('option', { name: 'Active account' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Inactive account' })).not.toBeInTheDocument()
    })

    it('does not offer administrator edits to a role manager', async () => {
        mocks.get.mockResolvedValue({ data: {
            canManage: true, canGrantAdmin: false, availablePermissions: ['tenant.admin'],
            roles: [{ id: 'admin-role', name: 'Admin', permissions: ['tenant.admin'], users: [7] }],
            members: [{ id: 7, name: 'Alex', roleIds: ['admin-role'], permissions: ['tenant.admin'], isOwner: false, isSystemOwner: false }],
        } })
        renderRoles()

        expect(await screen.findByRole('button', { name: 'Edit roles' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Edit Admin' })).toBeDisabled()
    })
})
