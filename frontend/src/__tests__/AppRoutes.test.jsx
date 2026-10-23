import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useAuth } from '../contexts/AuthContext'
import { AppRoutes } from '../App'

vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'))

vi.mock('react-hot-toast', () => ({
    Toaster: () => null,
    toast: { remove: vi.fn() },
}))

vi.mock('../hooks/useDocumentTitle', () => ({
    useAutoPageTitle: vi.fn(),
    useDocumentTitle: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
    AuthProvider: ({ children }) => children,
    useAuth: vi.fn(() => ({ user: { username: 'editor' } })),
}))

vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/StatusBar', () => ({ default: () => null }))
vi.mock('../pages/ProfilePage', () => ({ default: () => <div>Personal profile</div> }))

vi.mock('../components/PrivateRoute', () => ({
    default: ({ children }) => children,
}))

vi.mock('../components/SettingsLayout', () => ({
    default: ({ children }) => <div data-testid="settings-layout">{children}</div>,
}))

vi.mock('../components/statistics/ExperimentManager', () => ({
    default: () => <div>A/B Testing manager</div>,
}))

vi.mock('../utils/tenant', () => ({
    getCurrentTenantId: () => 'tenant-test',
}))

const LocationProbe = () => {
    const location = useLocation()
    return <div data-testid="location">{location.pathname}</div>
}

describe('AppRoutes', () => {
    it('waits for authentication then lands empty roles in Profile', async () => {
        useAuth.mockReturnValue({ isLoading: true, user: null })
        const app = <MemoryRouter initialEntries={['/']}><AppRoutes /><LocationProbe /></MemoryRouter>
        const { rerender } = render(app)
        expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
        useAuth.mockReturnValue({ isLoading: false, user: { username: 'inbox-only', permissions: [] } })
        rerender(<MemoryRouter initialEntries={['/']}><AppRoutes /><LocationProbe /></MemoryRouter>)
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/profile'))
        expect(screen.getByText('Personal profile')).toBeInTheDocument()
    })

    it('redirects the legacy experiments route into Settings', async () => {
        render(
            <MemoryRouter initialEntries={['/experiments']}>
                <AppRoutes />
                <LocationProbe />
            </MemoryRouter>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/settings/experiments')
        })
        expect(screen.getByTestId('settings-layout')).toContainElement(screen.getByText('A/B Testing manager'))
    })
})
