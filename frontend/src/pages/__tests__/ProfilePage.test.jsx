import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfilePage from '../ProfilePage'

const mocks = vi.hoisted(() => ({
    user: null,
    tenant: 'first-workspace',
    unreadCount: 3,
    addNotification: vi.fn(),
    changePassword: vi.fn(),
    switchCurrentWorkspace: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => await importOriginal())

vi.mock('../../components/support/useSupportContext', () => ({
    useSupportTenant: () => mocks.tenant,
    useSupportContext: () => ({ data: { unreadCount: mocks.unreadCount } }),
}))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../../contexts/GlobalNotificationContext', () => ({ useGlobalNotifications: () => ({ addNotification: mocks.addNotification }) }))
vi.mock('../../api/users', () => ({ changePassword: mocks.changePassword, switchCurrentWorkspace: mocks.switchCurrentWorkspace }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('../../utils/tenant', () => ({
    getCurrentTenantId: () => 'first-workspace',
    setCurrentTenantId: vi.fn(),
}))

const renderProfile = (state) => render(
    <MemoryRouter initialEntries={[{ pathname: '/profile', state }]}>
        <ProfilePage />
    </MemoryRouter>,
)

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.tenant = 'first-workspace'
        mocks.unreadCount = 3
        mocks.user = {
            username: 'dev_auto_user',
            canSwitchTenant: true,
            currentWorkspace: { identifier: 'first-workspace' },
            designerTenants: [
                { id: '1', identifier: 'first-workspace', name: 'First workspace' },
                { id: '2', identifier: 'second-workspace', name: 'Second workspace' },
            ],
        }
    })

    it('provides personal tools with workspace scope, unread count and report source', () => {
        renderProfile({ reportFrom: 'https://cms.example/pages/42?private=value#section' })
        expect(screen.getByRole('link', { name: 'Inbox (3)' })).toHaveAttribute('href', '/inbox?tenant=first-workspace')
        expect(screen.getByRole('link', { name: 'Kanban' })).toHaveAttribute('href', '/kanban')
        const reportUrl = new URL(screen.getByRole('link', { name: 'Rapportera fel' }).href)
        expect(reportUrl.searchParams.get('tenant')).toBe('first-workspace')
        expect(reportUrl.searchParams.get('from')).toBe('https://cms.example/pages/42')
    })

    it('provides links without a workspace or unread messages', () => {
        mocks.tenant = ''
        mocks.unreadCount = 0
        renderProfile()
        expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('href', '/inbox')
        expect(screen.getByRole('link', { name: 'Rapportera fel' })).toBeInTheDocument()
    })

    it('shows active workspace choices to privileged users', () => {
        renderProfile()
        expect(screen.getByLabelText('Current workspace')).toHaveValue('first-workspace')
        expect(screen.getByRole('option', { name: 'Second workspace' })).toBeInTheDocument()
        expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument()
    })

    it('does not show workspace switching to ordinary users', () => {
        mocks.user = { username: 'editor', canSwitchTenant: false, designerTenants: [] }
        renderProfile()
        expect(screen.queryByLabelText('Current workspace')).not.toBeInTheDocument()
    })
})
