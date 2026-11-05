import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PrivateRoute from '../PrivateRoute'
import { setCurrentTenantId } from '../../utils/tenant'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

vi.unmock('react-router-dom')

const mocks = vi.hoisted(() => ({ user: { permissions: [] } }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isAuthenticated: true, isLoading: false }) }))
vi.mock('../Navbar', () => ({ default: () => <nav>Navigation</nav> }))
vi.mock('../StatusBar', () => ({ default: () => <footer>Status</footer> }))

describe('route access feedback', () => {
    afterEach(() => { setCmsCopyLanguage('en-us'); setCurrentTenantId('') })
    it('keeps navigation and offers a workspace-scoped request without loading a denied view', () => {
        mocks.user = { permissions: [] }
        setCurrentTenantId('workspace-a')
        setCmsCopyLanguage('sv-se')
        render(<MemoryRouter initialEntries={['/pages?ignored=private']}><PrivateRoute><div>Protected view</div></PrivateRoute></MemoryRouter>)
        expect(screen.getByRole('navigation')).toBeInTheDocument()
        expect(screen.queryByText('Protected view')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Du saknar åtkomst till den här vyn' })).toBeInTheDocument()
        const href = screen.getByRole('link', { name: 'Begär mer åtkomst' }).getAttribute('href')
        const params = new URL(href, 'https://cms.example.invalid').searchParams
        expect(params.get('tenant')).toBe('workspace-a')
        expect(params.get('from')).toMatch(/\/pages$/)
        expect(href).not.toContain('private')
    })
    it('allows permitted views', () => {
        mocks.user = { permissions: ['page.read'] }
        render(<MemoryRouter initialEntries={['/pages']}><PrivateRoute><div>Protected view</div></PrivateRoute></MemoryRouter>)
        expect(screen.getByText('Protected view')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Request more access' })).not.toBeInTheDocument()
    })
})
