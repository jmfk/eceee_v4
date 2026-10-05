import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

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
    useAuth: () => ({ user: { username: 'editor' } }),
}))

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
