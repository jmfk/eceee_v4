import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PageVersionHistoryPanel from '../PageVersionHistoryPanel'
import { versionsApi } from '../../api/versions'

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
        versionsApi.getPageVersionsList.mockResolvedValue(versions)
        versionsApi.compare.mockResolvedValue({ changes: { fieldsChanged: ['metaTitle'] } })
        versionsApi.restore.mockResolvedValue({ version: versions[0] })
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
                workflow={{ editableVersion: { id: 11 } }}
                onRestored={onRestored}
            />
        )

        fireEvent.click(await screen.findByRole('button', { name: /restore as working/i }))

        await waitFor(() => expect(versionsApi.restore).toHaveBeenCalledWith(10))
        expect(onRestored).toHaveBeenCalledWith(versions[0])
        expect(versionsApi).not.toHaveProperty('publish')
    })
})
