import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfilePage from '../ProfilePage'

const mocks = vi.hoisted(() => ({
    user: null,
    addNotification: vi.fn(),
    changePassword: vi.fn(),
    switchCurrentWorkspace: vi.fn(),
}))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../../contexts/GlobalNotificationContext', () => ({ useGlobalNotifications: () => ({ addNotification: mocks.addNotification }) }))
vi.mock('../../api/users', () => ({ changePassword: mocks.changePassword, switchCurrentWorkspace: mocks.switchCurrentWorkspace }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'first-workspace' }))

describe('ProfilePage workspace selection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
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

    it('shows active workspace choices to privileged users', () => {
        render(<ProfilePage />)
        expect(screen.getByLabelText('Current workspace')).toHaveValue('first-workspace')
        expect(screen.getByRole('option', { name: 'Second workspace' })).toBeInTheDocument()
        expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument()
    })

    it('does not show workspace switching to ordinary users', () => {
        mocks.user = { username: 'editor', canSwitchTenant: false, designerTenants: [] }
        render(<ProfilePage />)
        expect(screen.queryByLabelText('Current workspace')).not.toBeInTheDocument()
    })
})
