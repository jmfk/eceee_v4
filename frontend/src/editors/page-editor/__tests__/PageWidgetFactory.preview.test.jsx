import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../widgets', () => ({
    getWidgetComponent: () => ({ config }) => (
        <div className="banner-widget">{config.textContent}</div>
    ),
    getWidgetDisplayName: () => 'Banner',
    getWidgetIcon: () => null,
}))
vi.mock('../../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({
        hoveredWidgetId: null,
        setHoveredWidget: vi.fn(),
        clearHoveredWidget: vi.fn(),
    }),
}))

import PageWidgetFactory from '../PageWidgetFactory'

describe('PageWidgetFactory preview markup', () => {
    it('keeps the rendered widget as the direct widget-item child', () => {
        const { container } = render(
            <PageWidgetFactory
                widget={{
                    id: 'banner-1',
                    type: 'easy_widgets.BannerWidget',
                    config: { textContent: 'Preview banner' },
                }}
                slotName="main"
                index={0}
                mode="display"
                showControls={false}
            />
        )

        const widgetItem = container.querySelector('.widget-item')
        expect(widgetItem.firstElementChild).toHaveClass('banner-widget')
        expect(widgetItem.querySelector('.widget-content-wrapper')).toBeNull()
    })
})
