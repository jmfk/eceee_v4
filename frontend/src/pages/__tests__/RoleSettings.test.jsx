import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoleSettings from '../RoleSettings'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

const mocks = vi.hoisted(() => ({ language: 'en-us', get: vi.fn() }))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ language: mocks.language }) }))
vi.mock('../../components/support/useSupportContext', () => ({ useSupportTenant: () => 'test' }))
vi.mock('../../api/client', () => ({ default: { get: mocks.get, post: vi.fn() } }))

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
})
