import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import DesignerNavbar from '../DesignerNavbar'

const logout = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        logout,
        user: {
            username: 'editor',
            canSwitchTenant: true,
        },
    }),
}))

describe('DesignerNavbar', () => {
    it('keeps workspace selection in profile rather than Designer navigation', () => {
        render(<MemoryRouter><DesignerNavbar /></MemoryRouter>)

        expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
})
