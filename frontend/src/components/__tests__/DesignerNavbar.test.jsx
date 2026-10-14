import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DesignerNavbar from '../DesignerNavbar'

const auth = vi.hoisted(() => ({
    logout: vi.fn(),
    user: null,
}))

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => auth,
}))

describe('DesignerNavbar', () => {
    beforeEach(() => {
        auth.logout.mockReset()
        auth.user = {
            username: 'designer',
            designerTenants: [
                { id: '1', identifier: 'first-workspace', name: 'First workspace' },
                { id: '2', identifier: 'second-workspace', name: 'Second workspace' },
            ],
        }
    })

    it('offers CMS users a direct path back to the page overview', () => {
        render(<MemoryRouter><DesignerNavbar /></MemoryRouter>)

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.getByText('designer')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Back to CMS' })).toHaveAttribute('href', '/pages')
    })

    it('does not offer CMS navigation to Designer-only users', () => {
        auth.user = { ...auth.user, isDesignerOnly: true }

        render(<MemoryRouter><DesignerNavbar /></MemoryRouter>)

        expect(screen.queryByRole('link', { name: 'Back to CMS' })).not.toBeInTheDocument()
    })

    it('prevents CMS navigation while local Designer changes are unsaved', () => {
        render(<MemoryRouter><DesignerNavbar cmsNavigationDisabled /></MemoryRouter>)

        expect(screen.queryByRole('link', { name: 'Back to CMS' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back to CMS' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Back to CMS' })).toHaveAttribute(
            'title',
            'Save or discard local changes before returning to CMS',
        )
    })
})
