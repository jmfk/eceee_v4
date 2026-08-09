import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReactLayoutRenderer, { isDifferentWidgetSourceContext } from '../ReactLayoutRenderer'

const publishUpdateMock = vi.hoisted(() => vi.fn())

vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn(),
        publishUpdate: publishUpdateMock
    })
}))

vi.mock('../../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({
        clipboardData: null,
        pasteModeActive: false,
        pasteModePaused: false,
        togglePasteMode: vi.fn(),
        clearClipboardState: vi.fn(),
        refreshClipboard: vi.fn()
    })
}))

vi.mock('../../../hooks/useWidgets', () => ({
    useWidgets: () => ({
        addWidget: vi.fn()
    }),
    createDefaultWidgetConfig: vi.fn(() => ({}))
}))

vi.mock('../../../layouts', () => ({
    getLayoutComponent: () => function TestLayout({ onWidgetAction, onDeleteCutWidgets }) {
        return (
            <div>
                <button
                    type="button"
                    onClick={() => onDeleteCutWidgets({
                        pageId: 'page-1',
                        versionId: 'version-a',
                        widgetPaths: ['main/source-widget']
                    })}
                >
                    Delete cut source
                </button>
                <button
                    type="button"
                    onClick={() => onWidgetAction(
                        'paste',
                        'main',
                        {
                            id: 'pasted-widget',
                            type: 'easy_widgets.ContentWidget',
                            config: { content: 'Pasted' }
                        },
                        -1,
                        {
                            operation: 'cut',
                            metadata: {
                                pageId: 'page-1',
                                versionId: 'version-a',
                                widgetPaths: ['main/source-widget']
                            }
                        }
                    )}
                >
                    Paste cut source
                </button>
            </div>
        )
    },
    getLayoutMetadata: () => ({}),
    LAYOUT_REGISTRY: { main_layout: true }
}))

vi.mock('../PageWidgetSelectionModal', () => ({
    default: () => null
}))

vi.mock('../../../components/ImportDialog', () => ({
    default: () => null
}))

const baseProps = {
    layoutName: 'main_layout',
    widgets: {
        main: [
            {
                id: 'destination-widget',
                type: 'easy_widgets.ContentWidget',
                config: { content: 'Existing destination' }
            }
        ]
    },
    currentVersion: { id: 'version-b' },
    webpageData: { id: 'page-1' },
    context: { pageId: 'page-1' },
    sharedComponentId: 'renderer-test'
}

describe('ReactLayoutRenderer cut source context', () => {
    beforeEach(() => {
        publishUpdateMock.mockReset()
    })

    it('treats same-page different-version cuts as cross-context', () => {
        expect(isDifferentWidgetSourceContext({
            sourcePageId: 'page-1',
            sourceVersionId: 'version-a',
            currentPageId: 'page-1',
            currentVersionId: 'version-b'
        })).toBe(true)
    })

    it('deletes cut widgets from the source version when page id matches but version differs', async () => {
        const onWidgetChange = vi.fn()

        render(<ReactLayoutRenderer {...baseProps} onWidgetChange={onWidgetChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'Delete cut source' }))

        await waitFor(() => {
            expect(publishUpdateMock).toHaveBeenCalledOnce()
        })
        expect(publishUpdateMock).toHaveBeenCalledWith(
            'renderer-test',
            'REMOVE_WIDGET',
            {
                id: 'source-widget',
                contextType: 'page',
                pageId: 'page-1',
                versionId: 'version-a'
            }
        )
        expect(onWidgetChange).not.toHaveBeenCalled()
    })

    it('keeps paste on the destination version and removes the cut source from its original version', async () => {
        const onWidgetChange = vi.fn()

        render(<ReactLayoutRenderer {...baseProps} onWidgetChange={onWidgetChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'Paste cut source' }))

        await waitFor(() => {
            expect(publishUpdateMock).toHaveBeenCalledTimes(2)
        })
        expect(publishUpdateMock).toHaveBeenNthCalledWith(
            1,
            'renderer-test',
            'REMOVE_WIDGET',
            {
                id: 'source-widget',
                contextType: 'page',
                pageId: 'page-1',
                versionId: 'version-a'
            }
        )
        expect(publishUpdateMock).toHaveBeenNthCalledWith(
            2,
            'renderer-test',
            'ADD_WIDGET',
            {
                id: 'pasted-widget',
                type: 'easy_widgets.ContentWidget',
                config: { content: 'Pasted' },
                slot: 'main',
                contextType: 'page',
                pageId: 'page-1',
                versionId: 'version-b',
                order: 0
            }
        )
        expect(onWidgetChange).toHaveBeenCalledWith(
            {
                main: [
                    expect.objectContaining({ id: 'pasted-widget' }),
                    expect.objectContaining({ id: 'destination-widget' })
                ]
            },
            { sourceId: 'pasted-widget' }
        )
    })
})
