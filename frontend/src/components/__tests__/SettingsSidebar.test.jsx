import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
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

    it('collapses to a narrow rail and can be expanded again', () => {
        renderSidebar()

        fireEvent.click(screen.getByRole('button', { name: 'Collapse settings menu' }))

        expect(screen.getByRole('complementary')).toHaveClass('w-14')
        expect(screen.queryByRole('navigation', { name: 'Settings' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand settings menu' })).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(screen.getByRole('button', { name: 'Expand settings menu' }))

        expect(screen.getByRole('complementary')).toHaveClass('w-64')
        expect(screen.getByRole('navigation', { name: 'Settings' })).toBeInTheDocument()
    })

    it('keeps layouts inside each theme instead of showing a standalone destination', () => {
        renderSidebar()

        expect(screen.queryByRole('link', { name: 'Layout Overview' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'All Themes' })).toHaveAttribute('href', '/settings/themes')
    })
})
