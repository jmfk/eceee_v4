import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PrivateVideoThumbnail from './PrivateVideoThumbnail'
import { supportRequest } from '../../api/support'

vi.mock('./useSupportContext', () => ({ useSupportTenant: () => 'workspace-a', useSupportIdentity: () => 42 }))
vi.mock('../../api/support', () => ({ supportRequest: vi.fn() }))
let intersect: (entries: { isIntersecting: boolean }[]) => void
const disconnect = vi.fn()
const renderThumbnail = (id?: string) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PrivateVideoThumbnail id={id} />
    </QueryClientProvider>,
)
beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IntersectionObserver', class {
        constructor(callback: typeof intersect) { intersect = callback }
        observe() {}
        disconnect = disconnect
    })
    vi.mocked(supportRequest).mockResolvedValue({ url: 'https://private.example.invalid/frame' })
})
afterEach(() => vi.unstubAllGlobals())

describe('private video thumbnail', () => {
    it('waits until visible, loads a paused frame, and has no player controls', async () => {
        const { container } = renderThumbnail('video-1')
        expect(supportRequest).not.toHaveBeenCalled()
        act(() => intersect([{ isIntersecting: true }]))
        await waitFor(() => expect(supportRequest).toHaveBeenCalledWith('workspace-a', 'videos/video-1/playback/'))
        const video = container.querySelector('video')!
        expect(video).not.toHaveAttribute('controls')
        expect(video).not.toHaveAttribute('autoplay')
        Object.defineProperty(video, 'duration', { value: 0.5 })
        fireEvent.loadedMetadata(video)
        expect(video.currentTime).toBeGreaterThan(0)
        expect(video.currentTime).toBeLessThan(video.duration)
        fireEvent.seeked(video)
        expect(video).toHaveClass('is-ready')
        expect(disconnect).toHaveBeenCalled()
    })
    it('renews an expired playback URL only once and retains a fallback', async () => {
        const { container } = renderThumbnail('video-1')
        act(() => intersect([{ isIntersecting: true }]))
        await waitFor(() => expect(container.querySelector('video')).not.toBeNull())
        const firstVideo = container.querySelector('video')!
        fireEvent.error(firstVideo)
        await waitFor(() => expect(supportRequest).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(container.querySelector('video')).not.toBeNull())
        expect(container.querySelector('video')).not.toBe(firstVideo)
        fireEvent.error(container.querySelector('video')!)
        expect(container.querySelector('video')).toBeNull()
        expect(container.querySelector('.instruction-thumbnail-play')).not.toBeNull()
        expect(supportRequest).toHaveBeenCalledTimes(2)
    })
    it('does not request unpublished or missing media', () => {
        renderThumbnail()
        expect(supportRequest).not.toHaveBeenCalled()
    })
})
