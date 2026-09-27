import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import DesignerNavbar from '../DesignerNavbar'

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        logout: vi.fn(),
        user: {
            username: 'designer',
            designerTenants: [
                { id: '1', identifier: 'first-workspace', name: 'First workspace' },
                { id: '2', identifier: 'second-workspace', name: 'Second workspace' },
            ],
        },
    }),
}))

describe('DesignerNavbar', () => {
    it('does not offer workspace switching', () => {
        render(<MemoryRouter><DesignerNavbar /></MemoryRouter>)

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.getByText('designer')).toBeInTheDocument()
    })
})
