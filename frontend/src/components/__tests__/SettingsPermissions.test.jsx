import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import SettingsSidebar from '../SettingsSidebar'
import SettingsDashboard from '../SettingsDashboard'
import { themesApi } from '../../api'
import { objectTypesApi } from '../../api/objectStorage'
import { api } from '../../api/client'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { permissions: ['roles.manage'] } }) }))
vi.mock('../../api', () => ({ themesApi: { list: vi.fn(async () => []) } }))
vi.mock('../../api/objectStorage', () => ({ objectTypesApi: { list: vi.fn(async () => ({ data: [] })) } }))
vi.mock('../../api/client', () => ({ api: { get: vi.fn(async () => ({ data: { status: 'healthy' } })) } }))

describe('Settings permissions', () => {
    it('shows authorized settings and avoids denied dashboard queries and actions', () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter>
            <SettingsSidebar /><SettingsDashboard />
        </MemoryRouter></QueryClientProvider>)
        expect(screen.getAllByRole('link', { name: /Roles and permissions/ })).toHaveLength(2)
        for (const name of ['All Themes', 'Object Types', 'Manage Users', 'Create New Page', 'Data Connections']) {
            expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
        }
        expect(themesApi.list).not.toHaveBeenCalled()
        expect(objectTypesApi.list).not.toHaveBeenCalled()
        expect(api.get).not.toHaveBeenCalledWith('/api/v1/webpages/pages/')
    })
})
