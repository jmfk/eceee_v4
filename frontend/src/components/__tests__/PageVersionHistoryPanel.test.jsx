import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PageVersionHistoryPanel from '../PageVersionHistoryPanel'
import { versionsApi } from '../../api/versions'
import { setCurrentTenantId } from '../../utils/tenant'

vi.mock('../../api/versions', () => ({
    versionsApi: {
        getPageVersionsList: vi.fn(),
        compare: vi.fn(),
        restore: vi.fn(),
    },
}))

const versions = [
    {
        id: 11,
        versionNumber: 2,
        versionTitle: 'Working copy',
        publicationStatus: 'draft',
        createdAt: '2030-01-02T10:00:00Z',
    },
    {
        id: 10,
        versionNumber: 1,
        versionTitle: 'First publication',
        publicationStatus: 'published',
        createdAt: '2030-01-01T10:00:00Z',
    },
]

describe('PageVersionHistoryPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        setCurrentTenantId('theme-tenant')
        versionsApi.getPageVersionsList.mockResolvedValue(versions)
        versionsApi.compare.mockResolvedValue({ changes: { fieldsChanged: ['metaTitle'] } })
        versionsApi.restore.mockResolvedValue({ version: versions[0] })
    })

    it('opens a TypeScript preview for a historical version', async () => {
        const onRestoreError = vi.fn()
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
        render(
            <PageVersionHistoryPanel
                pageId={4}
                workflow={{ editableVersion: { id: 11 } }}
                onRestoreError={onRestoreError}
            />
        )

        const previewButtons = await screen.findAllByRole('button', { name: /preview/i })
        fireEvent.click(previewButtons[1])

        expect(openSpy).toHaveBeenCalledWith(
            '/_render-version/4/10/?workspace=theme-tenant',
            '_blank',
            'noopener,noreferrer'
        )
        expect(onRestoreError).not.toHaveBeenCalled()
    })

    it('opens a historical version in the read-only editor without restoring it', async () => {
        const onViewVersion = vi.fn()
        render(<PageVersionHistoryPanel pageId={4} workflow={{ editableVersion: { id: 11 } }} onViewVersion={onViewVersion} />)
        fireEvent.click((await screen.findAllByRole('button', { name: 'View' }))[1])
        expect(onViewVersion).toHaveBeenCalledWith(10)
        expect(versionsApi.restore).not.toHaveBeenCalled()
    })

    it('keeps technical version details in history and reports legacy conflicts', async () => {
        render(
            <PageVersionHistoryPanel
                pageId={4}
                workflow={{
                    editableVersion: { id: 11 },
                    legacyConflicts: { olderDraftCount: 1, additionalScheduledCount: 1 },
                }}
            />
        )

        expect(await screen.findByText('v2')).toBeInTheDocument()
        expect(screen.getByText('Working')).toBeInTheDocument()
        expect(screen.getByText(/legacy parallel drafts or schedules/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /restore as working/i })).toBeInTheDocument()
    })

    it('compares two selected history versions', async () => {
        render(<PageVersionHistoryPanel pageId={4} workflow={{ editableVersion: { id: 11 } }} />)

        await screen.findByText('v2')
        fireEvent.click(screen.getByRole('checkbox', { name: /compare version 2/i }))
        fireEvent.click(screen.getByRole('checkbox', { name: /compare version 1/i }))

        await waitFor(() => expect(versionsApi.compare).toHaveBeenCalledWith(11, 10))
        expect(await screen.findByText(/1 changed fields/i)).toBeInTheDocument()
    })

    it('restores historical content into the working copy without publishing', async () => {
        const onRestored = vi.fn()
        render(
            <PageVersionHistoryPanel
                pageId={4}
                workflow={{ editableVersion: { id: 11, updatedAt: '2030-01-02T10:00:00Z' } }}
                onRestored={onRestored}
            />
        )

        fireEvent.click(await screen.findByRole('button', { name: /restore as working/i }))

        await waitFor(() => expect(versionsApi.restore).toHaveBeenCalledWith(10, '2030-01-02T10:00:00Z'))
        expect(onRestored).toHaveBeenCalledWith(versions[0])
        expect(versionsApi).not.toHaveProperty('publish')
    })

    it('does not restore when replacement is not confirmed', async () => {
        const confirmRestore = vi.fn().mockResolvedValue(false)
        render(
            <PageVersionHistoryPanel
                pageId={4}
                workflow={{ editableVersion: { id: 11, updatedAt: '2030-01-02T10:00:00Z' } }}
                confirmRestore={confirmRestore}
            />
        )

        fireEvent.click(await screen.findByRole('button', { name: /restore as working/i }))

        await waitFor(() => expect(confirmRestore).toHaveBeenCalledTimes(1))
        expect(versionsApi.restore).not.toHaveBeenCalled()
    })

    it('reports restore conflicts and refreshes history', async () => {
        const onRestoreError = vi.fn()
        const conflict = new Error('The working version changed. Refresh and try again.')
        versionsApi.restore.mockRejectedValue(conflict)
        render(
            <PageVersionHistoryPanel
                pageId={4}
                workflow={{ editableVersion: { id: 11, updatedAt: '2030-01-02T10:00:00Z' } }}
                onRestoreError={onRestoreError}
            />
        )

        fireEvent.click(await screen.findByRole('button', { name: /restore as working/i }))

        await waitFor(() => expect(onRestoreError).toHaveBeenCalledWith(conflict))
        expect(versionsApi.getPageVersionsList).toHaveBeenCalledTimes(2)
    })
})
