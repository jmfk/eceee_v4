import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePageWebSocket } from '../usePageWebSocket'

class MockWebSocket {
    static OPEN = 1
    static instances = []

    constructor(url) {
        this.url = url
        this.readyState = MockWebSocket.OPEN
        this.send = vi.fn()
        MockWebSocket.instances.push(this)
    }

    close() {
        this.readyState = 3
    }

    message(data) {
        this.onmessage?.({ data: JSON.stringify(data) })
    }
}

describe('usePageWebSocket', () => {
    beforeEach(() => {
        MockWebSocket.instances = []
        vi.stubGlobal('WebSocket', MockWebSocket)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('ignores duplicate and out-of-order revisions', async () => {
        const onVersionUpdated = vi.fn()
        renderHook(() => usePageWebSocket(7, { knownRevision: 4, onVersionUpdated }))
        const socket = MockWebSocket.instances[0]

        act(() => {
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, revision: 6 })
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, revision: 5 })
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, revision: 6 })
        })

        await waitFor(() => expect(onVersionUpdated).toHaveBeenCalledTimes(1))
        expect(onVersionUpdated.mock.calls[0][0].revision).toBe(6)
    })

    it('accepts a lower revision after the working version changes', async () => {
        const onVersionUpdated = vi.fn()
        const { rerender } = renderHook(
            ({ versionId, revision }) => usePageWebSocket(7, {
                knownVersionId: versionId,
                knownRevision: revision,
                onVersionUpdated,
            }),
            { initialProps: { versionId: 9, revision: 8 } },
        )
        const socket = MockWebSocket.instances[0]

        rerender({ versionId: 10, revision: 1 })
        act(() => {
            socket.message({ type: 'version_updated', page_id: 7, version_id: 10, revision: 2 })
        })

        await waitFor(() => expect(onVersionUpdated).toHaveBeenCalledTimes(1))
        expect(onVersionUpdated.mock.calls[0][0]).toEqual(expect.objectContaining({
            versionId: 10,
            revision: 2,
        }))
    })

    it('keeps another tab present when one connection for the same user leaves', async () => {
        const { result } = renderHook(() => usePageWebSocket(7))
        const socket = MockWebSocket.instances[0]

        act(() => {
            socket.message({ type: 'connection_established', connection_id: 'self' })
            socket.message({
                type: 'presence', action: 'join', connection_id: 'tab-a',
                user: { id: 2, username: 'editor', display_name: 'Editor' },
                section: 'content', widget_id: null,
            })
            socket.message({
                type: 'presence', action: 'join', connection_id: 'tab-b',
                user: { id: 2, username: 'editor', display_name: 'Editor' },
                section: 'settings', widget_id: 'widget-2',
            })
        })

        await waitFor(() => expect(result.current.activeEditors).toHaveLength(1))
        expect(result.current.activeEditors[0]).toEqual(expect.objectContaining({
            connectionId: 'tab-b', section: 'settings', widgetId: 'widget-2',
        }))

        act(() => socket.message({
            type: 'presence', action: 'leave', connection_id: 'tab-b',
            user: { id: 2, username: 'editor', display_name: 'Editor' },
            section: 'settings', widget_id: 'widget-2',
        }))

        await waitFor(() => expect(result.current.activeEditors[0].connectionId).toBe('tab-a'))
    })

    it('expires an abandoned presence connection after sixty seconds', () => {
        vi.useFakeTimers()
        const { result } = renderHook(() => usePageWebSocket(7))
        const socket = MockWebSocket.instances[0]

        act(() => socket.message({
            type: 'presence', action: 'join', connection_id: 'abandoned',
            user: { id: 3, username: 'gone', display_name: 'Gone Editor' },
            section: 'content', widget_id: null,
        }))
        expect(result.current.activeEditors).toHaveLength(1)

        act(() => vi.advanceTimersByTime(70000))

        expect(result.current.activeEditors).toHaveLength(0)
    })
})
