import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../test/testUtils'
import DesignerThemesPage from '../DesignerThemesPage'

const mocks = vi.hoisted(() => ({
    list: vi.fn(), compare: vi.fn(), versions: vi.fn(), createVersion: vi.fn(), nameVersion: vi.fn(), restoreVersion: vi.fn(),
    remoteConnections: vi.fn(), createRemoteConnection: vi.fn(), updateRemoteConnection: vi.fn(), deleteRemoteConnection: vi.fn(),
    remoteThemes: vi.fn(), pullRemoteTheme: vi.fn(), pushRemoteTheme: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({ designerThemesApi: mocks }))
vi.mock('../../components/DesignerNavbar', () => ({ default: () => <div>Designer navigation</div> }))
vi.mock('../../components/StatusBar', () => ({ default: ({ customStatusContent }) => <div>{customStatusContent}</div> }))

const themes = [
    { id: 1, name: 'Editorial', description: '', versionCount: 3, updatedAt: '2026-09-26T08:00:00Z' },
    { id: 2, name: 'Campaign', description: '', versionCount: 1, updatedAt: '2026-09-25T08:00:00Z' },
]

describe('DesignerThemesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.list.mockResolvedValue({ results: themes, canManageRemotes: true })
        mocks.remoteConnections.mockResolvedValue({
            results: [{ id: 'connection-1', name: 'Production', baseUrl: 'https://remote.example', remoteWorkspace: 'remote', isDefault: true }],
            canManage: true,
        })
        mocks.compare.mockResolvedValue({ identical: false, changedAreas: ['colors'], changedPaths: ['colors.brand'], newerThemeId: 1 })
        mocks.versions.mockResolvedValue({ results: [{ id: 10, versionNumber: 3, name: 'Approved', createdAt: '2026-09-26T08:00:00Z', source: 'web', isCurrent: true }] })
    })

    it('compares two themes and exposes version history', async () => {
        renderWithStateProviders(<DesignerThemesPage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByLabelText('Select Editorial for comparison'))
        fireEvent.click(screen.getByLabelText('Select Campaign for comparison'))
        fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
        expect(await screen.findByText('1 differences found.')).toBeInTheDocument()
        expect(screen.getByText('Editorial is newer.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '3 versions' }))
        await waitFor(() => expect(screen.getByText('v3')).toBeInTheDocument())
        expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('creates named checkpoints and renames existing versions', async () => {
        mocks.createVersion.mockResolvedValue({ id: 11, versionNumber: 4, name: 'Before rebrand' })
        mocks.nameVersion.mockResolvedValue({ id: 10, versionNumber: 3, name: 'Production' })
        renderWithStateProviders(<DesignerThemesPage />)
        await screen.findByRole('heading', { name: 'Editorial' })
        fireEvent.click(screen.getByRole('button', { name: '3 versions' }))
        const checkpointName = await screen.findByLabelText('New version name for Editorial')
        fireEvent.change(checkpointName, { target: { value: 'Before rebrand' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save version' }))
        await waitFor(() => expect(mocks.createVersion).toHaveBeenCalledWith(1, 'Before rebrand'))

        fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
        fireEvent.change(screen.getByLabelText('Name for version 3'), { target: { value: 'Production' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(mocks.nameVersion).toHaveBeenCalledWith(1, 10, 'Production'))
    })

    it('uses workspace language and never exposes a saved access key', async () => {
        renderWithStateProviders(<DesignerThemesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Remote sites' }))
        expect(screen.getByLabelText('Remote site')).toHaveValue('connection-1')
        expect(screen.getByText('Choose a saved connection. Access keys remain protected on the server.')).toBeInTheDocument()
        expect(screen.queryByLabelText('Access key')).not.toBeInTheDocument()
        expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument()
    })

    it('lets an administrator add another saved remote site', async () => {
        mocks.createRemoteConnection.mockResolvedValue({ id: 'connection-2' })
        renderWithStateProviders(<DesignerThemesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Remote sites' }))
        fireEvent.click(screen.getByRole('button', { name: 'Add remote site' }))
        fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'Staging' } })
        fireEvent.change(screen.getByLabelText('Site URL'), { target: { value: 'https://staging.example' } })
        fireEvent.change(screen.getByLabelText('Remote workspace'), { target: { value: 'staging' } })
        fireEvent.change(screen.getByLabelText('Access key'), { target: { value: 'write-only-value' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))
        await waitFor(() => expect(mocks.createRemoteConnection).toHaveBeenCalledWith(expect.objectContaining({ name: 'Staging', remoteWorkspace: 'staging' })))
    })
})
