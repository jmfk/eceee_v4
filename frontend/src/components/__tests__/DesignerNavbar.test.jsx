import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DesignerNavbar from '../DesignerNavbar'

vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'))

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

        expect(screen.getByRole('link', { name: 'Media' })).toHaveAttribute('href', '/media')
        expect(screen.getByRole('link', { name: 'Designer' })).toHaveAttribute('href', '/designer/themes')
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.getByText('designer')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Back to CMS' })).toHaveAttribute('href', '/pages')
    })

    it('does not offer CMS navigation to Designer-only users', () => {
        auth.user = { ...auth.user, isDesignerOnly: true, permissions: ['theme.read', 'site.read'] }

        render(<MemoryRouter initialEntries={['/designer/media']}><DesignerNavbar /></MemoryRouter>)

        expect(screen.queryByRole('link', { name: 'Back to CMS' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Media' })).toHaveAttribute('href', '/designer/media')
        expect(screen.getByRole('link', { name: 'Media' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: 'Designer' })).not.toHaveAttribute('aria-current')
    })

    it('omits Media when a CMS theme reader lacks media access', () => {
        auth.user = { ...auth.user, permissions: ['theme.read'] }
        render(<MemoryRouter initialEntries={['/designer/themes']}><DesignerNavbar /></MemoryRouter>)
        expect(screen.queryByRole('link', { name: 'Media' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Designer' })).toHaveAttribute('aria-current', 'page')
    })

    it('keeps the regular Media destination for CMS media readers', () => {
        auth.user = { ...auth.user, permissions: ['theme.read', 'media.read'] }
        render(<MemoryRouter><DesignerNavbar /></MemoryRouter>)
        expect(screen.getByRole('link', { name: 'Media' })).toHaveAttribute('href', '/media')
    })

    it('prevents CMS navigation while local Designer changes are unsaved', () => {
        render(<MemoryRouter><DesignerNavbar cmsNavigationDisabled /></MemoryRouter>)

        expect(screen.queryByRole('link', { name: 'Back to CMS' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back to CMS' })).toBeDisabled()
        expect(screen.queryByRole('link', { name: 'Media' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Media' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Back to CMS' })).toHaveAttribute(
            'title',
            'Save or discard local changes before returning to CMS',
        )
    })
})
