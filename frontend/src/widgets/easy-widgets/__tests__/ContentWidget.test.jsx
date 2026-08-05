import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { StrictMode } from 'react'

// --- Mocks ---

// Mock ContentWidgetEditorRenderer so we can capture the onChange callback
// and simulate editor output without a real DOM WYSIWYG.
let capturedOnChange = null
let rendererInstances = []
let publishUpdateMock = vi.fn()
let externalChangeCallbacks = []
vi.mock('../ContentWidgetEditorRenderer.js', () => {
    return {
        default: vi.fn(function (container, options) {
            this.container = container
            this.options = { ...options }
            this.onChange = options.onChange
            capturedOnChange = this.onChange
            this.content = options.content || ''
            this.editorElement = null
            this.destroyed = false
            this.listenerCounts = {}
            this.listenerAddCounts = {}
            this.listenerRemoveCounts = {}
            this.render = vi.fn(() => {
                const el = document.createElement('div')
                el.setAttribute('contenteditable', 'true')
                el.innerHTML = this.content
                const addEventListener = el.addEventListener.bind(el)
                const removeEventListener = el.removeEventListener.bind(el)
                el.addEventListener = (type, listener, ...args) => {
                    this.listenerCounts[type] = (this.listenerCounts[type] || 0) + 1
                    this.listenerAddCounts[type] = (this.listenerAddCounts[type] || 0) + 1
                    return addEventListener(type, listener, ...args)
                }
                el.removeEventListener = (type, listener, ...args) => {
                    this.listenerCounts[type] = Math.max((this.listenerCounts[type] || 0) - 1, 0)
                    this.listenerRemoveCounts[type] = (this.listenerRemoveCounts[type] || 0) + 1
                    return removeEventListener(type, listener, ...args)
                }
                this.editorElement = el
                container.appendChild(el)
            })
            this.updateConfig = vi.fn((cfg) => {
                this.options = { ...this.options, ...cfg }
                if (cfg.onChange !== undefined) {
                    this.onChange = cfg.onChange
                    capturedOnChange = this.onChange
                }
                if (cfg.content !== undefined) {
                    this.content = cfg.content
                    if (this.editorElement) {
                        this.editorElement.innerHTML = cfg.content
                    }
                }
            })
            this.activate = vi.fn()
            this.deactivate = vi.fn()
            this.destroy = vi.fn(() => {
                this.editorElement?.remove()
                this.destroyed = true
            })
            this.emitChange = (html) => {
                this.content = html
                if (this.editorElement) {
                    this.editorElement.innerHTML = html
                }
                this.onChange(html)
            }
            rendererInstances.push(this)
        }),
    }
})

// Minimal useUnifiedData mock: capture subscriptions and direct publishes.
vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn((componentId, callback) => {
            externalChangeCallbacks.push({ componentId, callback })
        }),
        publishUpdate: publishUpdateMock,
    }),
}))

vi.mock('../../../contexts/unified-data/hooks', () => ({
    useEditorContext: () => 'page',
}))

// Import after mocks are set up
import ContentWidget from '../ContentWidget'

// ---------------------------------------------------------------------------

describe('ContentWidget', () => {
    beforeEach(() => {
        capturedOnChange = null
        rendererInstances = []
        publishUpdateMock = vi.fn()
        externalChangeCallbacks = []
        vi.clearAllMocks()
    })

    const latestRenderer = () => rendererInstances[rendererInstances.length - 1]
    const activeRenderer = () => [...rendererInstances]
        .reverse()
        .find(renderer => renderer.editorElement?.isConnected && renderer.listenerAddCounts.focus > 0)
    const flushDeferredListenerSetup = () => act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
        await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('renders in display mode with provided content', () => {
        const { container } = render(
            <ContentWidget
                config={{ content: '<p>Hello world</p>' }}
                mode="display"
                widgetId="w1"
                slotName="main"
            />
        )
        expect(container.innerHTML).toContain('Hello world')
    })

    it('emits one canonical parent update and does not publish directly when editor fires onChange', async () => {
        const onConfigChange = vi.fn()
        render(
            <ContentWidget
                config={{ content: '<p>Initial</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={onConfigChange}
            />
        )

        expect(capturedOnChange).toBeTypeOf('function')

        await act(async () => {
            capturedOnChange('<p>Updated content</p>')
        })

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith(
            expect.objectContaining({ content: '<p>Updated content</p>' })
        )
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('applies external content prop updates to the editable DOM', async () => {
        const { rerender } = render(
            <ContentWidget
                config={{ content: '<p>Initial</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={vi.fn()}
            />
        )

        const renderer = latestRenderer()
        expect(renderer.editorElement.innerHTML).toBe('<p>Initial</p>')

        await act(async () => {
            rerender(
                <ContentWidget
                    config={{ content: '<h2>Externally updated</h2>' }}
                    mode="editor"
                    widgetId="w1"
                    slotName="main"
                    onConfigChange={vi.fn()}
                />
            )
        })

        expect(renderer.editorElement.innerHTML).toBe('<h2>Externally updated</h2>')
    })

    it('uses the latest onConfigChange callback after parent rerenders', async () => {
        const staleOnConfigChange = vi.fn()
        const latestOnConfigChange = vi.fn()
        const { rerender } = render(
            <ContentWidget
                config={{ content: '<p>Initial</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={staleOnConfigChange}
            />
        )

        await act(async () => {
            rerender(
                <ContentWidget
                    config={{ content: '<p>Initial</p>' }}
                    mode="editor"
                    widgetId="w1"
                    slotName="main"
                    onConfigChange={latestOnConfigChange}
                />
            )
        })

        await act(async () => {
            latestRenderer().emitChange('<p>Fresh callback edit</p>')
        })

        expect(staleOnConfigChange).not.toHaveBeenCalled()
        expect(latestOnConfigChange).toHaveBeenCalledOnce()
        expect(latestOnConfigChange).toHaveBeenCalledWith(
            expect.objectContaining({ content: '<p>Fresh callback edit</p>' })
        )
    })

    it('does not echo duplicate parent updates back into repeated saves', async () => {
        const onConfigChange = vi.fn()
        const { rerender } = render(
            <ContentWidget
                config={{ content: '<p>Initial</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={onConfigChange}
            />
        )
        const renderer = latestRenderer()
        renderer.updateConfig.mockClear()

        await act(async () => {
            renderer.emitChange('<p>User edit</p>')
        })

        await act(async () => {
            rerender(
                <ContentWidget
                    config={{ content: '<p>User edit</p>' }}
                    mode="editor"
                    widgetId="w1"
                    slotName="main"
                    onConfigChange={onConfigChange}
                />
            )
        })

        const contentUpdateCalls = renderer.updateConfig.mock.calls.filter(([cfg]) =>
            Object.prototype.hasOwnProperty.call(cfg, 'content')
        )
        expect(onConfigChange).toHaveBeenCalledTimes(1)
        expect(contentUpdateCalls).toHaveLength(0)
        expect(renderer.editorElement.innerHTML).toBe('<p>User edit</p>')
    })

    it('does NOT call onConfigChange when content is unchanged', async () => {
        const onConfigChange = vi.fn()
        render(
            <ContentWidget
                config={{ content: '<p>Same</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={onConfigChange}
            />
        )

        await act(async () => {
            capturedOnChange('<p>Same</p>')
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('applies external UDC content without echoing it back as a user edit', async () => {
        const onConfigChange = vi.fn()
        render(
            <ContentWidget
                config={{ content: '<p>Initial</p>', isActive: true }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={onConfigChange}
            />
        )

        const renderer = latestRenderer()
        const subscription = externalChangeCallbacks.find(item => item.componentId === 'widget-w1')

        await act(async () => {
            subscription.callback({
                versions: {
                    current: {
                        widgets: {
                            main: [
                                {
                                    id: 'w1',
                                    type: 'easy_widgets.ContentWidget',
                                    config: { content: '<p>External update</p>', isActive: true }
                                }
                            ]
                        }
                    }
                },
                metadata: {
                    currentVersionId: 'current'
                }
            })
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
        expect(renderer.editorElement.innerHTML).toBe('<p>External update</p>')
    })

    it('picks up prop-driven content change (e.g. undo)', async () => {
        const onConfigChange = vi.fn()
        const { rerender } = render(
            <ContentWidget
                config={{ content: '<p>Original</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={onConfigChange}
            />
        )

        // Simulate undo: parent passes new config prop
        await act(async () => {
            rerender(
                <ContentWidget
                    config={{ content: '<p>Reverted</p>' }}
                    mode="editor"
                    widgetId="w1"
                    slotName="main"
                    onConfigChange={onConfigChange}
                />
            )
        })

        // After prop change, a subsequent editor edit should emit the new base content
        await act(async () => {
            capturedOnChange('<p>New edit after revert</p>')
        })

        expect(onConfigChange).toHaveBeenCalledWith(
            expect.objectContaining({ content: '<p>New edit after revert</p>' })
        )
    })

    it('cleans up deferred event listeners and destroys the editor on unmount', async () => {
        const { unmount } = render(
            <ContentWidget
                config={{ content: '<p>Initial</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={vi.fn()}
            />
        )

        const renderer = latestRenderer()

        await flushDeferredListenerSetup()

        expect(renderer.listenerAddCounts.focus).toBe(1)
        expect(renderer.listenerAddCounts.blur).toBe(1)

        unmount()

        expect(renderer.listenerRemoveCounts.focus).toBe(1)
        expect(renderer.listenerRemoveCounts.blur).toBe(1)
        expect(renderer.listenerCounts.focus).toBe(0)
        expect(renderer.listenerCounts.blur).toBe(0)
        expect(renderer.destroy).toHaveBeenCalledOnce()
    })

    it('does not double-bind focus and blur listeners in StrictMode', async () => {
        render(
            <StrictMode>
                <ContentWidget
                    config={{ content: '<p>Initial</p>' }}
                    mode="editor"
                    widgetId="w1"
                    slotName="main"
                    onConfigChange={vi.fn()}
                />
            </StrictMode>
        )

        await flushDeferredListenerSetup()
        const renderer = activeRenderer()

        expect(renderer.editorElement).toBeTruthy()
        expect(renderer.destroy).not.toHaveBeenCalled()
        expect(renderer.editorElement).toBeTruthy()
        expect(renderer.listenerCounts.focus).toBe(1)
        expect(renderer.listenerCounts.blur).toBe(1)

        renderer.editorElement.dispatchEvent(new Event('focus'))
        renderer.editorElement.dispatchEvent(new Event('blur'))

        expect(renderer.activate).toHaveBeenCalledOnce()
        expect(renderer.deactivate).toHaveBeenCalledOnce()
    })

    it('does not remount ContentWidgetEditorRenderer when onConfigChange identity changes', async () => {
        const ContentWidgetEditorRenderer = (await import('../ContentWidgetEditorRenderer.js')).default

        const { rerender } = render(
            <ContentWidget
                config={{ content: '<p>Test</p>' }}
                mode="editor"
                widgetId="w1"
                slotName="main"
                onConfigChange={vi.fn()}
            />
        )
        const instancesAfterMount = ContentWidgetEditorRenderer.mock.instances.length

        // Simulate parent re-render with a new function reference but same config
        for (let i = 0; i < 3; i++) {
            await act(async () => {
                rerender(
                    <ContentWidget
                        config={{ content: '<p>Test</p>' }}
                        mode="editor"
                        widgetId="w1"
                        slotName="main"
                        onConfigChange={vi.fn()}
                    />
                )
            })
        }

        // Renderer should still be the same instance — no flashing or remount
        expect(ContentWidgetEditorRenderer.mock.instances.length).toBe(instancesAfterMount)
    })
})
