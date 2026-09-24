import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import DesignerRoute from '../DesignerRoute'

const auth = vi.hoisted(() => ({ value: {} }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth.value }))

const renderRoute = () => render(
    <MemoryRouter initialEntries={['/designer/themes']}>
        <Routes>
            <Route path="/designer/themes" element={<DesignerRoute><div>Designer workspace</div></DesignerRoute>} />
            <Route path="/pages" element={<div>Pages</div>} />
            <Route path="/login" element={<div>Login</div>} />
        </Routes>
    </MemoryRouter>,
)

describe('DesignerRoute', () => {
    it('allows a restricted designer', () => {
        auth.value = { isAuthenticated: true, isLoading: false, user: { isDesignerOnly: true } }
        renderRoute()
        expect(screen.getByText('Designer workspace')).toBeInTheDocument()
    })

    it('allows a tenant administrator', () => {
        auth.value = { isAuthenticated: true, isLoading: false, user: { hasTenantAdminAccess: true } }
        renderRoute()
        expect(screen.getByText('Designer workspace')).toBeInTheDocument()
    })

    it('redirects an unrelated user', () => {
        auth.value = { isAuthenticated: true, isLoading: false, user: {} }
        renderRoute()
        expect(screen.getByText('Pages')).toBeInTheDocument()
    })
})
