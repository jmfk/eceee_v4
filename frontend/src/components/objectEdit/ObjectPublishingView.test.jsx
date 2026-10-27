import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectPublishingView from './ObjectPublishingView'

const mocks = vi.hoisted(() => ({ getWorkflow: vi.fn(), getVersions: vi.fn(), publish: vi.fn(), schedule: vi.fn(), unpublish: vi.fn(), cancelSchedule: vi.fn(), restore: vi.fn(), get: vi.fn(), confirm: vi.fn() }))
vi.mock('../../api/objectStorage', () => ({ objectInstancesApi: { getWorkflow: mocks.getWorkflow, getVersions: mocks.getVersions }, objectVersionsApi: mocks }))
vi.mock('../NotificationManager', () => ({ useNotificationContext: () => ({ showConfirm: mocks.confirm }) }))
const working = { id: 3, versionNumber: 3, editRevision: 8 }
const live = { id: 2, versionNumber: 2, editRevision: 5 }
const versions = [
    { ...working, title: 'Working title', publicationStatus: 'draft', createdAt: '2026-10-20T10:00:00Z' },
    { ...live, title: 'Live title', publicationStatus: 'published', createdAt: '2026-10-19T10:00:00Z' },
]
const workflow = { state: 'liveWithUnpublishedChanges', editableVersion: working, liveVersion: live, legacyConflicts: {} }
function mount(props = {}) {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ObjectPublishingView instance={{ id: '9' }} {...props} />
    </QueryClientProvider>)
}
beforeEach(() => {
    vi.resetAllMocks()
    mocks.getWorkflow.mockResolvedValue({ data: workflow })
    mocks.getVersions.mockResolvedValue({ data: versions })
    mocks.publish.mockResolvedValue({ data: {} })
    mocks.schedule.mockResolvedValue({ data: {} })
    mocks.restore.mockResolvedValue({ data: {} })
    mocks.confirm.mockResolvedValue(true)
})
describe('Object publishing workflow', () => {
    it('opens a historical version in the editor without restoring it', async () => {
        const onViewVersion = vi.fn()
        mount({ onViewVersion })
        fireEvent.click((await screen.findAllByRole('button', { name: 'View' }))[1])
        expect(onViewVersion).toHaveBeenCalledWith(2)
        expect(mocks.get).not.toHaveBeenCalled()
        expect(mocks.restore).not.toHaveBeenCalled()
    })
    it('shows aggregate state and history together', async () => {
        mount()
        expect(await screen.findByText('Live · unpublished changes')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
        expect(screen.getByText('Working title')).toBeInTheDocument()
    })
    it('publishes the explicitly reviewed working version', async () => {
        mount()
        fireEvent.click(await screen.findByRole('button', { name: 'Publish changes' }))
        await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(3, 8))
    })
    it('saves dirty content and publishes the returned revision', async () => {
        const save = vi.fn().mockResolvedValue({ id: 4, editRevision: 12 })
        mount({ isDirty: true, onSave: save })
        fireEvent.click(await screen.findByRole('button', { name: 'Publish changes' }))
        await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(4, 12))
        expect(save).toHaveBeenCalledOnce()
    })
    it('keeps save failures visible and does not publish', async () => {
        mount({ isDirty: true, onSave: vi.fn().mockRejectedValue(new Error('Review newer changes first.')) })
        fireEvent.click(await screen.findByRole('button', { name: 'Publish changes' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Review newer changes first.')
        expect(mocks.publish).not.toHaveBeenCalled()
    })
    it('schedules with an ISO date and reviewed revision', async () => {
        mount()
        const date = await screen.findByLabelText('Publish at')
        const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16)
        fireEvent.change(date, { target: { value: future } })
        fireEvent.click(screen.getByRole('button', { name: 'Schedule', exact: true }))
        await waitFor(() => expect(mocks.schedule).toHaveBeenCalledWith(3, { effective_date: new Date(future).toISOString() }, 8))
    })
    it('cancels a schedule with its reviewed revision', async () => {
        mocks.getWorkflow.mockResolvedValue({ data: { ...workflow, scheduledVersion: working, scheduledAt: '2099-01-01T10:00:00Z' } })
        mount()
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel schedule', exact: true }))
        await waitFor(() => expect(mocks.cancelSchedule).toHaveBeenCalledWith(working))
    })
    it('restores history into the working copy after confirmation', async () => {
        const restored = vi.fn()
        mount({ onRestored: restored, isDirty: true })
        fireEvent.click(await screen.findByRole('button', { name: 'Restore as working' }))
        await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith(2, working))
        expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('discard unsaved changes') }))
        await waitFor(() => expect(restored).toHaveBeenCalledOnce())
    })
    it('preserves history when restore is declined', async () => {
        mocks.confirm.mockResolvedValue(false)
        mount()
        fireEvent.click(await screen.findByRole('button', { name: 'Restore as working' }))
        await act(async () => {})
        expect(mocks.restore).not.toHaveBeenCalled()
    })
    it('lets authors feature the working copy without changing history', async () => {
        const changeFeatured = vi.fn()
        mount({ onFeaturedChange: changeFeatured, isFeatured: false })
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Featured in lists after publishing' }))
        expect(changeFeatured).toHaveBeenCalledWith(true)
        expect(mocks.publish).not.toHaveBeenCalled()
    })
    it('shows retry on loading failure rather than a false publication state', async () => {
        mocks.getWorkflow.mockRejectedValue(new Error('Offline'))
        mount()
        expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load publishing state.')
        expect(screen.queryByRole('button', { name: 'Publish changes' })).not.toBeInTheDocument()
    })
})
