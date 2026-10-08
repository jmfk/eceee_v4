import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../components/editors/SlotEditor', () => ({ default: () => null }))
vi.mock('../../../editors/page-editor/PageWidgetFactory', () => ({
    default: ({ widget }) => <div data-testid={`nested-${widget.id}`} />,
}))
vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({ useExternalChanges: vi.fn(), publishUpdate: vi.fn() }),
}))
vi.mock('../../../hooks/useWidgets', () => ({
    useWidgets: () => ({ widgetTypes: [], isLoadingTypes: false, typesError: null }),
}))
vi.mock('../../../hooks/useTheme', () => ({
    useTheme: () => ({ currentTheme: null }),
}))

import ThreeColumnsWidget from '../ThreeColumnsWidget'

describe('ThreeColumnsWidget display markup', () => {
    it('preserves the public class contract used by theme CSS', () => {
        const { container } = render(
            <ThreeColumnsWidget
                mode="display"
                widgetId="columns-1"
                config={{
                    layoutStyle: '2:2:2',
                    slots: {
                        left: [{ id: 'nested-1', type: 'easy_widgets.ContentWidget', config: {} }],
                        center: [],
                        right: [],
                    },
                }}
            />
        )

        const root = container.firstElementChild
        expect(root).toHaveClass(
            'three-columns-widget',
            'widget-type-easy-widgets-threecolumnswidget',
            'three-col-ratio-2-2-2'
        )
        expect(screen.getByTestId('nested-nested-1').parentElement).toHaveClass('three-col-widget-wrapper')
    })
})
