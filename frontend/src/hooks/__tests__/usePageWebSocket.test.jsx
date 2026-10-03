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
        renderHook(() => usePageWebSocket(7, {
            knownVersionId: 9,
            knownVersionNumber: 3,
            knownRevision: 4,
            onVersionUpdated,
        }))
        const socket = MockWebSocket.instances[0]

        act(() => {
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, version_number: 3, revision: 6 })
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, version_number: 3, revision: 5 })
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, version_number: 3, revision: 6 })
        })

        await waitFor(() => expect(onVersionUpdated).toHaveBeenCalledTimes(1))
        expect(onVersionUpdated.mock.calls[0][0].revision).toBe(6)
    })

    it('accepts a lower revision after the working version changes', async () => {
        const onVersionUpdated = vi.fn()
        renderHook(() => usePageWebSocket(7, {
            knownVersionId: 9,
            knownVersionNumber: 3,
            knownRevision: 8,
            onVersionUpdated,
        }))
        const socket = MockWebSocket.instances[0]

        act(() => {
            socket.message({ type: 'version_updated', page_id: 7, version_id: 10, version_number: 4, revision: 2 })
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, version_number: 3, revision: 9 })
        })

        await waitFor(() => expect(onVersionUpdated).toHaveBeenCalledTimes(1))
        expect(onVersionUpdated.mock.calls[0][0]).toEqual(expect.objectContaining({
            versionId: 10,
            versionNumber: 4,
            revision: 2,
        }))
    })

    it('marks an older callback stale when a newer update finishes first', async () => {
        let releaseFirstUpdate
        const firstUpdatePending = new Promise(resolve => {
            releaseFirstUpdate = resolve
        })
        const appliedRevisions = []
        let isLatestVersionUpdate
        const onVersionUpdated = vi.fn(async updateInfo => {
            if (updateInfo.revision === 5) await firstUpdatePending
            if (isLatestVersionUpdate(updateInfo)) {
                appliedRevisions.push(updateInfo.revision)
            }
        })
        const { result } = renderHook(() => usePageWebSocket(7, {
            knownVersionId: 9,
            knownVersionNumber: 3,
            knownRevision: 4,
            onVersionUpdated,
        }))
        isLatestVersionUpdate = result.current.isLatestVersionUpdate
        const socket = MockWebSocket.instances[0]

        act(() => {
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, version_number: 3, revision: 5 })
            socket.message({ type: 'version_updated', page_id: 7, version_id: 9, version_number: 3, revision: 6 })
        })

        await waitFor(() => expect(appliedRevisions).toEqual([6]))
        const firstCallback = onVersionUpdated.mock.results[0].value

        await act(async () => {
            releaseFirstUpdate()
            await firstCallback
        })
        expect(appliedRevisions).toEqual([6])
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

    it('moves the connection and presence state when the page changes', async () => {
        const { result, rerender } = renderHook(
            ({ pageId }) => usePageWebSocket(pageId),
            { initialProps: { pageId: 7 } },
        )
        const firstSocket = MockWebSocket.instances[0]

        act(() => firstSocket.message({
            type: 'presence', action: 'join', connection_id: 'page-seven-editor',
            user: { id: 2, username: 'editor', display_name: 'Editor' },
            section: 'content', widget_id: null,
        }))
        expect(result.current.activeEditors).toHaveLength(1)

        rerender({ pageId: 8 })

        await waitFor(() => expect(MockWebSocket.instances).toHaveLength(2))
        expect(firstSocket.readyState).toBe(3)
        expect(MockWebSocket.instances[1].url).toContain('/ws/pages/8/editor/')
        expect(result.current.activeEditors).toHaveLength(0)
    })
})
