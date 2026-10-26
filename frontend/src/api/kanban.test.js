import { afterEach, expect, it, vi } from 'vitest'
import { kanbanApi, kanbanSocketUrl } from './kanban'
import apiClient from './client'

vi.mock('./client', () => ({ default: { post: vi.fn() } }))
afterEach(() => vi.unstubAllEnvs())
it('uses the configured backend websocket endpoint rather than the Vite origin', () => {
    vi.stubEnv('VITE_WS_URL', 'ws://127.0.0.1:10101/')
    expect(kanbanSocketUrl('tenant')).toBe('ws://127.0.0.1:10101/ws/kanban/tenant/')
})

it('passes an abort signal through to image generation requests', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 'board-1' } })
    const controller = new AbortController()
    await kanbanApi.post('boards/board-1/generate-background/', { fromContent: true }, { signal: controller.signal })
    expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/kanban/boards/board-1/generate-background/',
        { from_content: true },
        { signal: controller.signal },
    )
})
