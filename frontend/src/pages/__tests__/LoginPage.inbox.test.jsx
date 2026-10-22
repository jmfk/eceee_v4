import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import LoginPage from '../LoginPage'

vi.unmock('react-router-dom')
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}))
vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: vi.fn() }),
}))

function Destination() {
    const location = useLocation()
    return (
        <p>
            {location.pathname}
            {location.search}
        </p>
    )
}

it('preserves the tenant query from a private inbox link after login', async () => {
    render(
        <MemoryRouter
            initialEntries={[
                {
                    pathname: '/login',
                    state: {
                        from: {
                            pathname: '/inbox/threads/thread-1',
                            search: '?tenant=target-tenant',
                        },
                    },
                },
            ]}
        >
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/inbox/*" element={<Destination />} />
            </Routes>
        </MemoryRouter>,
    )
    expect(
        await screen.findByText('/inbox/threads/thread-1?tenant=target-tenant'),
    ).toBeInTheDocument()
})
