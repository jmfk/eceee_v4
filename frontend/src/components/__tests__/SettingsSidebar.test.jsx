import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import SettingsSidebar from '../SettingsSidebar'

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useLocation: () => ({
            pathname: '/settings/experiments',
            search: '',
            hash: '',
            state: null,
        }),
    }
})

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { username: 'editor', isSuperuser: false } }),
}))

vi.mock('../../api', () => ({
    themesApi: { list: vi.fn(() => Promise.resolve([])) },
}))

const renderSidebar = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/settings/experiments']}>
                <SettingsSidebar />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('SettingsSidebar', () => {
    it('shows A/B Testing as an active first-level Settings destination', () => {
        renderSidebar()

        const experimentsLink = screen.getByRole('link', { name: 'A/B Testing' })

        expect(experimentsLink).toHaveAttribute('href', '/settings/experiments')
        expect(experimentsLink).toHaveClass('bg-blue-50', 'text-blue-700')
    })
})
