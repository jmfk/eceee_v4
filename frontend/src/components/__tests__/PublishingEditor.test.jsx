import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublishingEditor from '../PublishingEditor'
import { versionsApi } from '../../api/versions'

const showConfirm = vi.fn()
const addNotification = vi.fn()

vi.mock('../../api/versions', () => ({
    versionsApi: {
        getWorkflow: vi.fn(),
        getOrCreateWorkingCopy: vi.fn(),
        getPageVersionsList: vi.fn(),
        publish: vi.fn(),
        scheduleWorkingCopy: vi.fn(),
        cancelWorkingCopySchedule: vi.fn(),
        unpublishExplicit: vi.fn(),
        publishVersionNowWithSubpages: vi.fn(),
        compare: vi.fn(),
        restore: vi.fn(),
    },
}))

vi.mock('../NotificationManager', () => ({
    useNotificationContext: () => ({ showConfirm }),
}))

vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification }),
}))

const renderEditor = props => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <PublishingEditor pageId={4} {...props} />
        </QueryClientProvider>
    )
}

describe('PublishingEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        showConfirm.mockResolvedValue(true)
        versionsApi.getWorkflow.mockResolvedValue({
            state: 'live_with_unpublished_changes',
            editableVersion: { id: 11, updatedAt: '2030-01-01T10:00:00Z' },
            liveVersion: { id: 10 },
        })
        versionsApi.getPageVersionsList.mockResolvedValue([])
        versionsApi.publish.mockResolvedValue({})
    })

    it('saves dirty editor state before publishing the returned version', async () => {
        const onSave = vi.fn().mockResolvedValue({ id: 12 })
        renderEditor({ isDirty: true, onSave })

        fireEvent.click(await screen.findByRole('button', { name: /publish changes/i }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(versionsApi.publish).toHaveBeenCalledWith(12)
    })
})
