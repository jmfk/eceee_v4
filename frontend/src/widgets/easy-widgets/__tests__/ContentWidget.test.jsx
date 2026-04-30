import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

// --- Mocks ---

// Mock ContentWidgetEditorRenderer so we can capture the onChange callback
// and simulate editor output without a real DOM WYSIWYG.
let capturedOnChange = null
vi.mock('../ContentWidgetEditorRenderer.js', () => {
    return {
        default: vi.fn(function (container, options) {
            capturedOnChange = options.onChange
            this.content = options.content || ''
            this.render = vi.fn(() => {
                const el = document.createElement('div')
                el.setAttribute('contenteditable', 'true')
                container.appendChild(el)
            })
            this.updateConfig = vi.fn((cfg) => {
                if (cfg.onChange !== undefined) capturedOnChange = cfg.onChange
                if (cfg.content !== undefined) this.content = cfg.content
            })
            this.activate = vi.fn()
            this.deactivate = vi.fn()
            this.destroy = vi.fn()
        }),
    }
})

// Minimal useUnifiedData mock: useExternalChanges does nothing in unit tests.
vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn(),
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
        vi.clearAllMocks()
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

    it('calls onConfigChange with updated config when editor fires onChange', async () => {
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
