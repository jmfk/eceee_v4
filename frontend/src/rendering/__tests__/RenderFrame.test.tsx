import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import RenderFrame from '../RenderFrame'
import type { RenderPageModel } from '../types'

const model = (content: string): RenderPageModel => ({
    layout: 'main_layout',
    slots: { main: [{ id: 'heading', type: 'easy_widgets.HeadlineWidget', config: { content } }] },
    context: { mode: 'preview' },
})

const notifyReady = (source: Window | null) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
        source,
        data: { source: 'eceee-render-frame', action: 'ready' },
    }))
})

describe('RenderFrame initialization', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

    it('waits for the host page to finish loading before starting the iframe', () => {
        vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
        render(<RenderFrame title="Preview" model={model('Initial')} />)
        expect(screen.queryByTitle('Preview')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Preparing preview')

        act(() => { window.dispatchEvent(new Event('load')) })

        expect(screen.getByTitle('Preview')).toHaveAttribute('src', '/__render-frame')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('starts the iframe if the host finishes loading before the effect subscribes', () => {
        vi.spyOn(document, 'readyState', 'get').mockReturnValueOnce('loading').mockReturnValue('complete')
        render(<RenderFrame title="Preview" model={model('Initial')} />)
        expect(screen.getByTitle('Preview')).toHaveAttribute('src', '/__render-frame')
    })

    it('recovers a navigation stuck on about:blank once and preserves unsaved content', () => {
        vi.useFakeTimers()
        vi.spyOn(HTMLIFrameElement.prototype, 'contentDocument', 'get').mockReturnValue({ URL: 'about:blank' } as Document)
        const { rerender } = render(<RenderFrame title="Preview" model={model('Initial')} />)
        const original = screen.getByTitle('Preview')
        rerender(<RenderFrame title="Preview" model={model('Unsaved content')} />)

        act(() => { vi.advanceTimersByTime(2000) })

        const recovered = screen.getByTitle('Preview') as HTMLIFrameElement
        expect(recovered).not.toBe(original)
        const postMessage = vi.spyOn(recovered.contentWindow!, 'postMessage')
        notifyReady(recovered.contentWindow)
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ model: model('Unsaved content') }), '*')

        act(() => { vi.advanceTimersByTime(10000) })
        expect(screen.getByTitle('Preview')).toBe(recovered)
    })

    it('does not restart a frame that has reached the preview document', () => {
        vi.useFakeTimers()
        vi.spyOn(HTMLIFrameElement.prototype, 'contentDocument', 'get').mockReturnValue({ URL: 'http://localhost/__render-frame' } as Document)
        render(<RenderFrame title="Preview" model={model('Initial')} />)
        const original = screen.getByTitle('Preview')

        act(() => { vi.advanceTimersByTime(10000) })

        expect(screen.getByTitle('Preview')).toBe(original)
    })

    it('sends the latest content on document load even when the ready notification was missed', () => {
        const { rerender } = render(<RenderFrame title="Preview" model={model('Initial')} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
        rerender(<RenderFrame title="Preview" model={model('Unsaved changes')} />)
        postMessage.mockClear()

        fireEvent.load(frame)

        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host', action: 'render', model: model('Unsaved changes'),
        }, '*')
    })

    it('does not repaint a ready document when its load notification arrives late', () => {
        render(<RenderFrame title="Preview" model={model('Initial')} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
        notifyReady(frame.contentWindow)
        postMessage.mockClear()

        fireEvent.load(frame)

        expect(postMessage).not.toHaveBeenCalled()
    })

    it('sends on load for a new document even when the previous document was ready', () => {
        render(<RenderFrame title="Preview" model={model('Initial')} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
        notifyReady(frame.contentWindow)
        postMessage.mockClear()
        vi.spyOn(frame, 'contentDocument', 'get').mockReturnValue(document.implementation.createHTMLDocument())

        fireEvent.load(frame)

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'render' }), '*')
    })

    it('resends the latest model on every ready notification after a frame reload', () => {
        const { rerender } = render(<RenderFrame title="Preview" model={model('Initial')} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
        notifyReady(frame.contentWindow)
        rerender(<RenderFrame title="Preview" model={model('Latest content')} />)
        postMessage.mockClear()

        notifyReady(frame.contentWindow)

        expect(postMessage).toHaveBeenCalledTimes(1)
        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host', action: 'render', model: model('Latest content'),
        }, '*')
    })

    it('sends edits without waiting for another ready notification', () => {
        const { rerender } = render(<RenderFrame title="Preview" model={model('Initial')} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')

        rerender(<RenderFrame title="Preview" model={model('Edited before ready')} />)

        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host', action: 'render', model: model('Edited before ready'),
        }, '*')
    })

    it('snapshots pending edits at send time without sending on each edit', () => {
        let pending = 'Initial'
        const prepareModel = () => model(pending)
        render(<RenderFrame title="Preview" model={model('Old compiled model')} prepareModel={prepareModel} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
        pending = 'Inline edit'
        expect(postMessage).not.toHaveBeenCalled()

        notifyReady(frame.contentWindow)

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ model: model('Inline edit') }), '*')
    })

    it('ignores ready notifications from another window', () => {
        const onMessage = vi.fn()
        render(<RenderFrame title="Preview" model={model('Initial')} onMessage={onMessage} />)
        const frame = screen.getByTitle('Preview') as HTMLIFrameElement
        const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')

        notifyReady(window)

        expect(postMessage).not.toHaveBeenCalled()
        expect(onMessage).not.toHaveBeenCalled()
    })
})
