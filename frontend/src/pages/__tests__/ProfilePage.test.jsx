import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfilePage from '../ProfilePage'

const mocks = vi.hoisted(() => ({
    user: null,
    tenant: 'first-workspace',
    unreadCount: 3,
    addNotification: vi.fn(),
    changePassword: vi.fn(),
    switchCurrentWorkspace: vi.fn(),
    updatePreferredLanguage: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => await importOriginal())

vi.mock('../../components/support/useSupportContext', () => ({
    useSupportTenant: () => mocks.tenant,
    useSupportContext: () => ({ data: { unreadCount: mocks.unreadCount } }),
}))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, language: 'en-us', setUser: mocks.setUser, logout: mocks.logout }) }))
vi.mock('../../contexts/GlobalNotificationContext', () => ({ useGlobalNotifications: () => ({ addNotification: mocks.addNotification }) }))
vi.mock('../../api/users', () => ({ changePassword: mocks.changePassword, switchCurrentWorkspace: mocks.switchCurrentWorkspace, updatePreferredLanguage: mocks.updatePreferredLanguage }))
vi.mock('../../components/auth/AccountSecurityPanel', () => ({ default: () => <section>Account security</section> }))
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
        expect(screen.getByRole('link', { name: 'Till CMS' })).toHaveAttribute('href', '/pages')
        expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
        expect(mocks.logout).toHaveBeenCalledOnce()
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

    it('lets a board guest select an accessible second workspace', () => {
        mocks.user = { ...mocks.user, canSwitchTenant: false, isKanbanBoardGuest: true }
        renderProfile()
        expect(screen.getByLabelText('Current workspace')).toHaveValue('first-workspace')
        expect(screen.getByRole('option', { name: 'Second workspace' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /Inbox/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Rapportera fel' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Kanban' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Till CMS' })).not.toBeInTheDocument()
    })

    it('saves a language override from Profile', async () => {
        mocks.updatePreferredLanguage.mockResolvedValue({ data: { preferredLanguage: 'sv-se' } })
        renderProfile()
        expect(screen.getByRole('combobox', { name: 'Preferred language' })).toHaveTextContent('Default (browser language)')
        fireEvent.click(screen.getByRole('combobox', { name: 'Preferred language' }))
        fireEvent.click(screen.getByRole('option', { name: 'Svenska' }))
        await waitFor(() => expect(mocks.updatePreferredLanguage).toHaveBeenCalledWith('sv-se'))
        expect(mocks.setUser).toHaveBeenCalled()
    })

    it('clears the override when Default is selected', async () => {
        mocks.user.preferredLanguage = 'sv-se'
        mocks.updatePreferredLanguage.mockResolvedValue({ data: { preferredLanguage: '' } })
        renderProfile()
        fireEvent.click(screen.getByRole('combobox', { name: 'Preferred language' }))
        fireEvent.click(screen.getByRole('option', { name: 'Default (browser language)' }))
        await waitFor(() => expect(mocks.updatePreferredLanguage).toHaveBeenCalledWith(''))
    })
})
