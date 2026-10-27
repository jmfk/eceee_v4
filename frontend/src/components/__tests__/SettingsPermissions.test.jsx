import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import SettingsSidebar from '../SettingsSidebar'
import SettingsDashboard from '../SettingsDashboard'
import { themesApi } from '../../api'
import { objectTypesApi } from '../../api/objectStorage'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { useSupportContext } from '../support/useSupportContext'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'))
vi.mock('../support/useSupportContext', () => ({ useSupportContext: vi.fn() }))
vi.mock('../../api', () => ({ themesApi: { list: vi.fn(async () => []) } }))
vi.mock('../../api/objectStorage', () => ({ objectTypesApi: { list: vi.fn(async () => ({ data: [] })) } }))
vi.mock('../../api/client', () => ({ api: { get: vi.fn(async () => ({ data: { status: 'healthy' } })) } }))

describe('Settings permissions', () => {
    it('shows authorized settings and avoids denied dashboard queries and actions', () => {
        useAuth.mockReturnValue({ user: { permissions: ['roles.manage'] } })
        useSupportContext.mockReturnValue({ data: { canSupport: false } })
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter>
            <SettingsSidebar /><SettingsDashboard />
        </MemoryRouter></QueryClientProvider>)
        expect(screen.getAllByRole('link', { name: /Användare och behörigheter/ })).toHaveLength(2)
        for (const name of ['All Themes', 'Object Types', 'System accounts', 'Create New Page', 'Data Connections']) {
            expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
        }
        expect(themesApi.list).not.toHaveBeenCalled()
        expect(objectTypesApi.list).not.toHaveBeenCalled()
        expect(api.get).not.toHaveBeenCalledWith('/api/v1/webpages/pages/')
    })

    it('shows Support but no other restricted settings to a directly assigned support agent', () => {
        useAuth.mockReturnValue({ user: { permissions: [] } })
        useSupportContext.mockReturnValue({ data: { canSupport: true } })
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter>
            <SettingsSidebar /><SettingsDashboard />
        </MemoryRouter></QueryClientProvider>)
        expect(screen.getAllByRole('link').filter((link) => link.getAttribute('href') === '/settings/support')).toHaveLength(2)
        expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /Användare och behörigheter/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Data Connections' })).not.toBeInTheDocument()
    })

    it('keeps a scoped workspace in Support and Roles links', () => {
        useAuth.mockReturnValue({ user: { permissions: ['roles.manage'] } })
        useSupportContext.mockReturnValue({ data: { canSupport: true } })
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/settings/support?tenant=a']}>
            <SettingsSidebar /><SettingsDashboard />
        </MemoryRouter></QueryClientProvider>)
        for (const path of ['/settings/support?tenant=a', '/settings/roles?tenant=a']) {
            expect(screen.getAllByRole('link').filter((link) => link.getAttribute('href') === path)).toHaveLength(2)
        }
    })
})
