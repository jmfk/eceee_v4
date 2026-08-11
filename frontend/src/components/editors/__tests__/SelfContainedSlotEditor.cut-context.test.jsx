import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SelfContainedSlotEditor } from '../SelfContainedSlotEditor.jsx'
import { cutWidgetsToClipboard, readClipboardWithMetadata } from '../../../utils/clipboardService'

vi.mock('../../../utils/clipboardService', () => ({
    copyWidgetsToClipboard: vi.fn(() => Promise.resolve(true)),
    cutWidgetsToClipboard: vi.fn(() => Promise.resolve(true)),
    readClipboardWithMetadata: vi.fn()
}))

vi.mock('../../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({
        refreshClipboard: vi.fn(),
        hoveredWidgetId: null,
        setHoveredWidget: vi.fn(),
        clearHoveredWidget: vi.fn()
    })
}))

vi.mock('../../../hooks/useWidgets.js', () => ({
    useWidgets: () => ({
        addWidget: vi.fn(),
        generateWidgetId: vi.fn(() => 'generated-widget'),
        widgetTypes: [],
        isLoadingTypes: false,
        typesError: null
    }),
    createDefaultWidgetConfig: vi.fn(() => ({})),
    getWidgetDisplayName: vi.fn(type => type?.split('.').pop() || type)
}))

vi.mock('../../../widgets', () => ({
    getWidgetComponent: () => function TestWidget() {
        return <div>Nested widget body</div>
    },
    getWidgetDisplayName: vi.fn(type => type?.split('.').pop() || type),
    getWidgetIcon: vi.fn(() => null)
}))

vi.mock('../../../utils/widgetPreview', () => ({
    renderWidgetPreview: vi.fn()
}))

vi.mock('../../../utils/pageEditorPropAdapter', () => ({
    createPageWidgetConfigChangeHandler: vi.fn(() => vi.fn())
}))

vi.mock('../../../editors/page-editor/PageWidgetSelectionModal.jsx', () => ({
    default: () => null
}))

vi.mock('../../help/ContextualHelpLink', () => ({
    default: () => null
}))

vi.mock('../../ConfirmationModal', () => ({
    default: () => null
}))

describe('SelfContainedSlotEditor cut metadata', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('cuts nested widgets with full widget path and page version context', async () => {
        const widget = {
            id: 'nested-widget',
            type: 'easy_widgets.ContentWidget',
            config: { content: '<p>Nested</p>' }
        }

        render(
            <SelfContainedSlotEditor
                slotName="content"
                slotLabel="Content"
                widgets={[widget]}
                parentWidgetId="container-widget"
                parentSlotName="main"
                contextType="page"
                pageId="page-1"
                versionId="version-a"
                parentComponentId="page-editor-page-1-version-a"
                widgetPath={['main', 'container-widget']}
                mode="editor"
            />
        )

        fireEvent.click(screen.getByTestId('page-widget-cut-easy-widgets-contentwidget'))

        await waitFor(() => {
            expect(cutWidgetsToClipboard).toHaveBeenCalledOnce()
        })
        expect(cutWidgetsToClipboard).toHaveBeenCalledWith(
            [widget],
            {
                pageId: 'page-1',
                versionId: 'version-a',
                widgetPaths: ['main/container-widget/content/nested-widget'],
                widgets: {
                    content: ['nested-widget']
                }
            }
        )
    })

    it('shows an actionable error when a pasted cut source cannot be removed', async () => {
        const onSlotChange = vi.fn()
        const onDeleteCutWidgets = vi.fn(() => Promise.reject(new Error('Only draft versions can be changed.')))
        readClipboardWithMetadata.mockResolvedValue({
            data: [{
                id: 'source-widget',
                type: 'easy_widgets.ContentWidget',
                config: { content: '<p>Source</p>' }
            }],
            operation: 'cut',
            metadata: {
                pageId: 'page-1',
                versionId: 'published-version',
                widgetPaths: ['main/source-widget']
            }
        })

        render(
            <SelfContainedSlotEditor
                slotName="content"
                slotLabel="Content"
                widgets={[]}
                parentWidgetId="container-widget"
                parentSlotName="main"
                contextType="page"
                pageId="page-2"
                versionId="draft-version"
                widgetPath={['main', 'container-widget']}
                onSlotChange={onSlotChange}
                onDeleteCutWidgets={onDeleteCutWidgets}
                mode="editor"
            />
        )

        fireEvent.click(screen.getByTestId('page-widget-slot-paste-content'))
        fireEvent.click(await screen.findByRole('button', { name: /Add to existing/i }))

        await waitFor(() => {
            expect(onDeleteCutWidgets).toHaveBeenCalledOnce()
        })
        expect(onSlotChange).toHaveBeenCalledOnce()
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Widgets were pasted, but the cut source was not removed: Only draft versions can be changed.'
        )
    })
})
