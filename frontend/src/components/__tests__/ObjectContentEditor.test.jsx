import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectContentEditor from '../ObjectContentEditor'

const publishUpdateMock = vi.hoisted(() => vi.fn())

vi.mock('../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn(),
        publishUpdate: publishUpdateMock
    })
}))

vi.mock('../../contexts/unified-data/hooks', () => ({
    useEditorContext: () => 'object'
}))

vi.mock('../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({
        clipboardData: null,
        pasteModeActive: false,
        pasteModePaused: false,
        togglePasteMode: vi.fn(),
        clearClipboardState: vi.fn(),
        refreshClipboard: vi.fn(),
        hoveredWidgetId: null,
        setHoveredWidget: vi.fn(),
        clearHoveredWidget: vi.fn()
    })
}))

vi.mock('../../utils/widgetTypeValidation', () => ({
    filterAvailableWidgetTypes: vi.fn(async widgetTypes => widgetTypes)
}))

vi.mock('../../api', () => ({
    widgetsApi: {
        getTypes: vi.fn(async () => [{ type: 'easy_widgets.BannerWidget' }])
    }
}))

vi.mock('../ImportDialog', () => ({
    default: () => null
}))

vi.mock('../WidgetSelectionModal', () => ({
    default: () => null
}))

vi.mock('../../widgets', () => ({
    getWidgetComponent: () => function MockInlineWidget({ config, onConfigChange }) {
        return (
            <button
                type="button"
                onClick={() => onConfigChange({ ...config, title: 'Updated inline title' })}
            >
                Update inline widget
            </button>
        )
    },
    getWidgetDisplayName: () => 'Mock Widget',
    createDefaultWidgetConfig: () => ({})
}))

const objectType = {
    name: 'Article',
    slotConfiguration: {
        slots: [
            {
                name: 'hero',
                label: 'Hero',
                widgetControls: [
                    {
                        widgetType: 'easy_widgets.BannerWidget',
                        label: 'Banner'
                    }
                ]
            }
        ]
    }
}

const widgets = {
    hero: [
        {
            id: 'banner-1',
            type: 'easy_widgets.BannerWidget',
            name: 'Banner',
            config: { title: 'Original title' }
        }
    ]
}

describe('ObjectContentEditor widget config updates', () => {
    beforeEach(() => {
        publishUpdateMock.mockReset()
    })

    it('publishes inline object widget config changes to Unified Data', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <ObjectContentEditor
                    objectType={objectType}
                    widgets={widgets}
                    context={{ instanceId: 'object-1' }}
                />
            </QueryClientProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Update inline widget' }))

        await waitFor(() => {
            expect(publishUpdateMock).toHaveBeenCalledOnce()
        })
        expect(publishUpdateMock).toHaveBeenCalledWith(
            'object-content-editor-object-1',
            'UPDATE_WIDGET_CONFIG',
            {
                id: 'banner-1',
                slotName: 'hero',
                contextType: 'object',
                config: { title: 'Updated inline title' }
            }
        )
    })
})
