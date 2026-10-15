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

import TwoColumnsWidget from '../TwoColumnsWidget'

describe('TwoColumnsWidget display markup', () => {
    it('preserves the semantic class contract used by canonical render CSS', () => {
        const { container } = render(
            <TwoColumnsWidget
                mode="display"
                widgetId="columns-1"
                config={{
                    layoutStyle: '3:3',
                    slots: {
                        left: [{ id: 'nested-1', type: 'easy_widgets.ContentWidget', config: {} }],
                        right: [],
                    },
                }}
            />
        )

        expect(container.firstElementChild).toHaveClass(
            'two-columns-widget',
            'two-col-ratio-3-3'
        )
        expect(screen.getByTestId('nested-nested-1').parentElement).toHaveClass('two-col-widget-wrapper')
        expect(container.querySelector('.two-col-slot.right')).toBeEmptyDOMElement()
    })
})
