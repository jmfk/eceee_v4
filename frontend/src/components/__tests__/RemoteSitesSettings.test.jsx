import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    listCheckpoints: vi.fn(),
    restoreCheckpoint: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))
vi.mock('../../api/objectTransfers', () => ({ objectTransfersApi: mocks }))

const connection = {
    id: 'connection-1',
    name: 'Production',
    baseUrl: 'https://remote.example',
    remoteWorkspace: 'default',
    credentialScheme: 'theme_key',
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
        mocks.listCheckpoints.mockResolvedValue({ results: [] })
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn(() => Promise.resolve()) },
        })
        window.confirm = vi.fn(() => true)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('unifies outgoing connections and incoming access keys', async () => {
        renderWithStateProviders(<RemoteSitesSettings />)

        expect(await screen.findByRole('heading', { name: 'Connections to other sites' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Access to this site' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Recovery checkpoints' })).toBeInTheDocument()
        expect(screen.getByText('Production')).toBeInTheDocument()
        expect(screen.getByText('Local development')).toBeInTheDocument()
        expect(screen.queryByText(/secret/i)).not.toBeInTheDocument()
    })

    it('lists and starts restoring a destination checkpoint', async () => {
        mocks.listCheckpoints.mockResolvedValue({ results: [{
            id: 'checkpoint-1',
            operation: 'object_import',
            status: 'available',
            resourceScopes: ['objects', 'media'],
            createdAt: '2026-10-09T10:00:00Z',
        }] })
        mocks.restoreCheckpoint.mockResolvedValue({
            id: 'checkpoint-1',
            operation: 'object_import',
            status: 'restore_pending',
            resourceScopes: ['objects', 'media'],
            createdAt: '2026-10-09T10:00:00Z',
        })
        renderWithStateProviders(<RemoteSitesSettings />)

        expect(await screen.findByText('Object import checkpoint')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

        expect(window.confirm).toHaveBeenCalledWith('Restore this checkpoint? Current object and media changes in its scope will be replaced.')
        await waitFor(() => expect(mocks.restoreCheckpoint).toHaveBeenCalledWith('checkpoint-1'))
        expect(await screen.findByRole('button', { name: 'Restore queued' })).toBeDisabled()
    })

    it('refetches loaded pages without losing checkpoints when page boundaries shift', async () => {
        const checkpoint = (id, createdAt) => ({
            id,
            operation: 'object_import',
            status: 'available',
            resourceScopes: ['objects'],
            createdAt,
        })
        mocks.listCheckpoints
            .mockResolvedValueOnce({
                results: [checkpoint('checkpoint-1', '2026-10-10T10:00:00Z')],
                next: '/api/v1/objects/remote/checkpoints/?cursor=cursor-2',
            })
            .mockResolvedValueOnce({
                results: [checkpoint('checkpoint-3', '2026-10-11T10:00:00Z')],
                next: '/api/v1/objects/remote/checkpoints/?cursor=cursor-2',
            })
            .mockResolvedValueOnce({
                results: [
                    checkpoint('checkpoint-1', '2026-10-10T10:00:00Z'),
                    checkpoint('checkpoint-2', '2026-10-09T10:00:00Z'),
                ],
                next: null,
            })

        renderWithStateProviders(<RemoteSitesSettings />)
        fireEvent.click(await screen.findByRole('button', { name: 'Load older checkpoints' }))

        await waitFor(() => expect(mocks.listCheckpoints).toHaveBeenCalledWith('cursor-2'))
        expect(screen.getAllByText('Object import checkpoint')).toHaveLength(3)
    })

    it('polls an asynchronous restore and reports a retryable failure', async () => {
        vi.useFakeTimers()
        const pending = {
            id: 'checkpoint-1',
            operation: 'object_import',
            status: 'restore_pending',
            resourceScopes: ['objects', 'media'],
            createdResources: { object_ids: ['123'] },
            canRestore: false,
            createdAt: '2026-10-09T10:00:00Z',
        }
        mocks.listCheckpoints
            .mockResolvedValueOnce({ results: [pending] })
            .mockResolvedValueOnce({
                results: [{ ...pending, status: 'failed', canRestore: true, errors: ['Storage temporarily unavailable.'] }],
            })

        renderWithStateProviders(<RemoteSitesSettings />)
        await act(async () => {})
        expect(screen.getByRole('button', { name: 'Restore queued' })).toBeDisabled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000)
        })

        expect(screen.getByRole('alert')).toHaveTextContent('Storage temporarily unavailable.')
        expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled()
    })

    it('shows failed binary cleanup as retryable', async () => {
        vi.useFakeTimers()
        mocks.listCheckpoints.mockResolvedValue({ results: [{
            id: 'checkpoint-cleanup',
            operation: 'object_import',
            status: 'restored',
            resourceScopes: ['media'],
            sourceDetails: { binaryCleanupPending: true },
            canRestore: true,
            errors: ['Binary cleanup failed: storage unavailable'],
            createdAt: '2026-10-09T10:00:00Z',
        }] })

        renderWithStateProviders(<RemoteSitesSettings />)

        expect(await screen.findByText('cleanup failed')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Binary cleanup failed')
        expect(screen.getByRole('button', { name: 'Retry cleanup' })).toBeEnabled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(4000)
        })
        expect(mocks.listCheckpoints).toHaveBeenCalledTimes(1)
    })

    it('does not queue another cleanup while an automatic retry is active', async () => {
        mocks.listCheckpoints.mockResolvedValue({ results: [{
            id: 'checkpoint-cleanup-active',
            operation: 'object_import',
            status: 'restored',
            resourceScopes: ['media'],
            sourceDetails: { binaryCleanupPending: true, binaryCleanupRetryActive: true },
            canRestore: false,
            errors: ['Binary cleanup failed: storage unavailable'],
            createdAt: '2026-10-09T10:00:00Z',
        }] })

        renderWithStateProviders(<RemoteSitesSettings />)

        expect(await screen.findByRole('button', { name: 'Retry cleanup' })).toBeDisabled()
        expect(mocks.restoreCheckpoint).not.toHaveBeenCalled()
    })

    it('creates an outgoing connection from Settings', async () => {
        mocks.createRemoteConnection.mockResolvedValue({ id: 'connection-2' })
        renderWithStateProviders(<RemoteSitesSettings />)
        await screen.findByText('Production')

        fireEvent.click(screen.getByRole('button', { name: 'Add connection' }))
        fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'Staging' } })
        fireEvent.change(screen.getByLabelText('Site URL'), { target: { value: 'https://staging.example' } })
        fireEvent.change(screen.getByLabelText('Remote workspace'), { target: { value: 'staging' } })
        fireEvent.change(screen.getByLabelText('Credential type'), { target: { value: 'api_key' } })
        fireEvent.change(screen.getByLabelText('Access key'), { target: { value: 'write-only-value' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))

        await waitFor(() => expect(mocks.createRemoteConnection).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Staging',
            remoteWorkspace: 'staging',
            accessKey: 'write-only-value',
            credentialScheme: 'api_key',
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
        expect(window.confirm).toHaveBeenCalledWith('Rotate “Local development”? The current key will stop working immediately.')
        await waitFor(() => expect(mocks.rotateRemoteAccessKey).toHaveBeenCalledWith('key-1', accessKey.capabilities))
        expect(await screen.findByText('eceee_theme_rotated-value')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
        expect(window.confirm).toHaveBeenCalledWith('Revoke “Local development”? Remote connections using it will stop working.')
        await waitFor(() => expect(mocks.revokeRemoteAccessKey).toHaveBeenCalledWith('key-1'))
    })

    it('does not rotate or revoke a key when confirmation is cancelled', async () => {
        window.confirm.mockReturnValue(false)
        renderWithStateProviders(<RemoteSitesSettings />)
        await screen.findByText('Local development')

        fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))
        fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

        expect(mocks.rotateRemoteAccessKey).not.toHaveBeenCalled()
        expect(mocks.revokeRemoteAccessKey).not.toHaveBeenCalled()
    })

    it('keeps a newly issued secret visible when refreshing the lists fails', async () => {
        mocks.createRemoteAccessKey.mockResolvedValue({
            id: 'key-2',
            name: 'Migration host',
            secret: 'eceee_theme_one-time-value',
            capabilities: ['theme.transfer'],
        })
        mocks.remoteConnections
            .mockResolvedValueOnce({ results: [connection], canManage: true })
            .mockRejectedValueOnce(new Error('refresh failed'))
        renderWithStateProviders(<RemoteSitesSettings />)
        await screen.findByText('Local development')

        fireEvent.click(screen.getByRole('button', { name: 'Create access key' }))
        fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'Migration host' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Create access key' })[1])

        expect(await screen.findByText('eceee_theme_one-time-value')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('The access key was created, but the settings list could not be refreshed.')
        expect(screen.queryByText('The access key could not be created.')).not.toBeInTheDocument()
    })
})
