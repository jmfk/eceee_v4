import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserPerspectiveButton from '../UserPerspectiveButton'
import UserPerspectiveBanner from '../UserPerspectiveBanner'

const mocks = vi.hoisted(() => ({ user: null, language: 'en-us', start: vi.fn(), stop: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, language: mocks.language }) }))
vi.mock('../../api/userPerspective', () => ({ IDENTITY_CHANGE_KEY: 'cms-identity-changed', startUserPerspective: mocks.start, stopUserPerspective: mocks.stop }))

describe('user perspective', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.user = { id: 1, isSuperuser: true }
        mocks.language = 'en-us'
        mocks.start.mockResolvedValue(undefined)
        mocks.stop.mockResolvedValue(undefined)
    })
    it('offers the action only to system owners and starts the selected user', async () => {
        const target = { id: 7, isActive: true }
        const view = render(<UserPerspectiveButton target={target} />)
        fireEvent.click(screen.getByRole('button', { name: 'View as user' }))
        await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(7))
        mocks.user = { id: 1, isSuperuser: false }
        view.rerender(<UserPerspectiveButton target={target} />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
    it.each([{ id: 1, isActive: true }, { id: 7, isActive: false }, { id: 7, isActive: true, isSuperuser: true }])('hides invalid targets %j', target => {
        render(<UserPerspectiveButton target={target} />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
    it('keeps an inline start failure actionable', async () => {
        mocks.start.mockRejectedValue({ response: { data: { detail: 'This account is inactive.' } } })
        render(<UserPerspectiveButton target={{ id: 7, isActive: true }} />)
        fireEvent.click(screen.getByRole('button', { name: 'View as user' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('This account is inactive.')
        expect(screen.getByRole('button', { name: 'View as user' })).toBeEnabled()
    })
    it('retains the return action after expiry', async () => {
        mocks.user = { id: 7, userPerspective: { username: 'Alex', expiresAt: 1, expired: true } }
        render(<UserPerspectiveBanner />)
        expect(screen.getByText('User perspective has ended.')).toBeInTheDocument()
        expect(screen.getByText(/Changes are made as this user/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Return to my account' }))
        await waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce())
    })
    it('explains a failed return inline and allows retry', async () => {
        mocks.user = { userPerspective: { username: 'Alex', expiresAt: Date.now() / 1000 + 1000 } }
        mocks.stop.mockRejectedValue(new Error('network'))
        render(<UserPerspectiveBanner />)
        expect(screen.getByText('Viewing as Alex')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Return to my account' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not return to your account. Try again.')
        expect(screen.getByRole('button', { name: 'Return to my account' })).toBeEnabled()
    })
})
