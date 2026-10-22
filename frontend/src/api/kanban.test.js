import { afterEach, expect, it, vi } from 'vitest'
import { kanbanSocketUrl } from './kanban'

vi.mock('./client', () => ({ default: {} }))
afterEach(() => vi.unstubAllEnvs())
it('uses the configured backend websocket endpoint rather than the Vite origin', () => {
    vi.stubEnv('VITE_WS_URL', 'ws://127.0.0.1:10101/')
    expect(kanbanSocketUrl('tenant')).toBe('ws://127.0.0.1:10101/ws/kanban/tenant/')
})
