import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PageWidgetHeader from '../PageWidgetHeader'

vi.mock('../../../utils/clipboardService', () => ({
    copyWidgetsToClipboard: vi.fn(() => Promise.resolve(true)),
    cutWidgetsToClipboard: vi.fn(() => Promise.resolve(true)),
    readClipboardWithMetadata: vi.fn(() => Promise.resolve({
        data: [{
            id: 'content-1',
            type: 'easy_widgets.ContentWidget',
            config: { content: '<p>Copied</p>' }
        }],
        operation: 'copy',
        metadata: {}
    }))
}))

vi.mock('../../../utils/widgetClipboard', () => ({
    generateNewWidgetIds: vi.fn(widget => ({ ...widget, id: 'pasted-content-1' }))
}))

vi.mock('../../../utils/howToHelp', () => ({
    getWidgetHelpTopic: vi.fn(() => null)
}))

vi.mock('../../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({
        refreshClipboard: vi.fn()
    })
}))

vi.mock('../../../components/help/ContextualHelpLink', () => ({
    default: () => null
}))

vi.mock('../../../components/ConfirmationModal', () => ({
    default: () => null
}))

describe('PageWidgetHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not let header paste clicks bubble into paste-mode wrapper handlers', async () => {
        const onPaste = vi.fn()
        const parentPasteClick = vi.fn()

        render(
            <div onClick={parentPasteClick}>
                <PageWidgetHeader
                    widgetType="Content"
                    widget={{
                        id: 'content-1',
                        type: 'easy_widgets.ContentWidget',
                        config: { content: '<p>Copied</p>' }
                    }}
                    slotName="main"
                    onPaste={onPaste}
                />
            </div>
        )

        fireEvent.click(screen.getByTestId('page-widget-paste-easy-widgets-contentwidget'))

        await waitFor(() => expect(onPaste).toHaveBeenCalledOnce())
        expect(parentPasteClick).not.toHaveBeenCalled()
        expect(onPaste).toHaveBeenCalledWith(expect.objectContaining({
            id: 'pasted-content-1'
        }), undefined)
    })

    it('operation-bar active toggle emits one parent config update', () => {
        const onConfigChange = vi.fn()

        render(
            <PageWidgetHeader
                widgetType="Content"
                widget={{
                    id: 'content-1',
                    type: 'easy_widgets.ContentWidget',
                    config: { content: '<p>Copy</p>', isActive: true }
                }}
                slotName="main"
                onConfigChange={onConfigChange}
            />
        )

        fireEvent.click(screen.getByTestId('page-widget-active-easy-widgets-contentwidget'))

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith({
            content: '<p>Copy</p>',
            isActive: false
        })
    })
})
