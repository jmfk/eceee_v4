import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../test/testUtils'
import RemoteSitesSettings from '../RemoteSitesSettings'

const mocks = vi.hoisted(() => ({
    remoteConnections: vi.fn(),
    createRemoteConnection: vi.fn(),
    updateRemoteConnection: vi.fn(),
    deleteRemoteConnection: vi.fn(),
    remoteAccessKeys: vi.fn(),
    createRemoteAccessKey: vi.fn(),
    rotateRemoteAccessKey: vi.fn(),
    revokeRemoteAccessKey: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))

const connection = {
    id: 'connection-1',
    name: 'Production',
    baseUrl: 'https://remote.example',
    remoteWorkspace: 'default',
    isDefault: true,
}

const accessKey = {
    id: 'key-1',
    name: 'Local development',
    keyPrefix: 'eceee_theme_',
    capabilities: ['theme.transfer', 'site.transfer'],
    isActive: true,
    createdAt: '2026-10-09T08:00:00Z',
    lastUsedAt: null,
}

describe('RemoteSitesSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.remoteConnections.mockResolvedValue({ results: [connection], canManage: true })
        mocks.remoteAccessKeys.mockResolvedValue({ results: [accessKey], syncEnabled: true })
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn(() => Promise.resolve()) },
        })
    })

    it('unifies outgoing connections and incoming access keys', async () => {
        renderWithStateProviders(<RemoteSitesSettings />)

        expect(await screen.findByRole('heading', { name: 'Connections to other sites' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Access to this site' })).toBeInTheDocument()
        expect(screen.getByText('Production')).toBeInTheDocument()
        expect(screen.getByText('Local development')).toBeInTheDocument()
        expect(screen.queryByText(/secret/i)).not.toBeInTheDocument()
    })

    it('creates an outgoing connection from Settings', async () => {
        mocks.createRemoteConnection.mockResolvedValue({ id: 'connection-2' })
        renderWithStateProviders(<RemoteSitesSettings />)
        await screen.findByText('Production')

        fireEvent.click(screen.getByRole('button', { name: 'Add connection' }))
        fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'Staging' } })
        fireEvent.change(screen.getByLabelText('Site URL'), { target: { value: 'https://staging.example' } })
        fireEvent.change(screen.getByLabelText('Remote workspace'), { target: { value: 'staging' } })
        fireEvent.change(screen.getByLabelText('Access key'), { target: { value: 'write-only-value' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))

        await waitFor(() => expect(mocks.createRemoteConnection).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Staging',
            remoteWorkspace: 'staging',
            accessKey: 'write-only-value',
        })))
    })

    it('creates and displays an inbound key once with explicit capabilities', async () => {
        mocks.createRemoteAccessKey.mockResolvedValue({
            id: 'key-2',
            name: 'Migration host',
            secret: 'eceee_theme_one-time-value',
            capabilities: ['theme.transfer', 'site.transfer'],
        })
        renderWithStateProviders(<RemoteSitesSettings />)
        await screen.findByText('Local development')

        fireEvent.click(screen.getByRole('button', { name: 'Create access key' }))
        fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'Migration host' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Create access key' })[1])

        expect(await screen.findByText('eceee_theme_one-time-value')).toBeInTheDocument()
        expect(mocks.createRemoteAccessKey).toHaveBeenCalledWith({
            name: 'Migration host',
            capabilities: ['theme.transfer', 'site.transfer'],
        })

        fireEvent.click(screen.getByRole('button', { name: 'Copy key' }))
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('eceee_theme_one-time-value'))
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss access key' }))
        expect(screen.queryByText('eceee_theme_one-time-value')).not.toBeInTheDocument()
    })

    it('rotates and revokes inbound keys', async () => {
        mocks.rotateRemoteAccessKey.mockResolvedValue({ ...accessKey, secret: 'eceee_theme_rotated-value' })
        mocks.revokeRemoteAccessKey.mockResolvedValue({ ...accessKey, isActive: false })
        renderWithStateProviders(<RemoteSitesSettings />)
        await screen.findByText('Local development')

        fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))
        await waitFor(() => expect(mocks.rotateRemoteAccessKey).toHaveBeenCalledWith('key-1', accessKey.capabilities))
        expect(await screen.findByText('eceee_theme_rotated-value')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
        await waitFor(() => expect(mocks.revokeRemoteAccessKey).toHaveBeenCalledWith('key-1'))
    })
})
