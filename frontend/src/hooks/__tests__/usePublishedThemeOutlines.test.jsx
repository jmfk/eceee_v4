import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublishedThemeOutlines } from '../usePublishedThemeOutlines'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../api/themes', () => ({ themesApi: { get: mocks.get } }))

describe('published theme outlines', () => {
    beforeEach(() => mocks.get.mockReset())
    afterEach(() => focusManager.setFocused(undefined))

    it('refreshes outlines after returning from Designer without losing local page theme settings', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
        const snapshot = { id: 8, colors: { primary: '#123456' }, textOutlineStyles: { dark: { name: 'Dark' } } }
        mocks.get.mockResolvedValueOnce({ id: 8, colors: { primary: '#ffffff' }, textOutlineStyles: snapshot.textOutlineStyles })
        const { result, unmount } = renderHook(() => usePublishedThemeOutlines(snapshot), { wrapper })
        await waitFor(() => expect(result.current).not.toBe(snapshot))
        mocks.get.mockResolvedValue({ id: 8, textOutlineStyles: { ...snapshot.textOutlineStyles, newStyle: { name: 'Published style' } } })
        act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
        await waitFor(() => expect(result.current.textOutlineStyles.newStyle.name).toBe('Published style'))
        expect(result.current.colors).toEqual(snapshot.colors)
        unmount()
        client.clear()
    })

    it('does not fetch a theme without an ID', () => {
        const client = new QueryClient()
        const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
        const theme = { textOutlineStyles: {} }
        const { result, unmount } = renderHook(() => usePublishedThemeOutlines(theme), { wrapper })
        expect(result.current).toBe(theme)
        expect(mocks.get).not.toHaveBeenCalled()
        unmount()
        client.clear()
    })
})
