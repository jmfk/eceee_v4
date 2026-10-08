import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WidgetSlot from '../WidgetSlot'

vi.mock('../../../editors/page-editor/PageWidgetFactory', () => ({
    default: ({ widget }) => (
        <div data-testid="rendered-widget">
            {widget.type}
        </div>
    )
}))

describe('WidgetSlot hidden empty restore bar', () => {
    const renderSlot = (props = {}) => render(
        <WidgetSlot
            name="header"
            label="Page Header"
            description="Site navigation"
            widgets={{}}
            slotMode="preview"
            editable={true}
            {...props}
        />
    )

    it('renders a restore bar for an editable empty preview slot', () => {
        const onSlotModeChange = vi.fn()

        const { container } = renderSlot({ onSlotModeChange })

        const restoreBar = screen.getByRole('button', { name: 'Show Page Header slot' })
        expect(restoreBar).toHaveTextContent('Page Header hidden - show slot')
        expect(container.querySelector('.widget-slot')).toHaveAttribute('data-hidden-empty-slot', 'true')
        expect(screen.queryByTitle('Exit slot preview mode')).not.toBeInTheDocument()
    })

    it('switches the slot back to edit mode when the restore bar is clicked', () => {
        const onSlotModeChange = vi.fn()

        renderSlot({ onSlotModeChange })

        fireEvent.click(screen.getByRole('button', { name: 'Show Page Header slot' }))

        expect(onSlotModeChange).toHaveBeenCalledWith('header', 'edit')
    })

    it('does not render the restore bar for a non-editable empty preview slot', () => {
        const { container } = renderSlot({ editable: false })

        expect(screen.queryByRole('button', { name: 'Show Page Header slot' })).not.toBeInTheDocument()
        expect(container.querySelector('[data-hidden-empty-slot="true"]')).not.toBeInTheDocument()
    })

    it('does not render the restore bar when preview mode has widgets', () => {
        const { container } = renderSlot({
            widgets: {
                header: [
                    {
                        id: 'widget-1',
                        type: 'easy_widgets.ContentWidget',
                        config: {}
                    }
                ]
            }
        })

        expect(screen.getByTestId('rendered-widget')).toHaveTextContent('easy_widgets.ContentWidget')
        expect(screen.getByTestId('rendered-widget').parentElement).toBe(container.querySelector('.widget-slot'))
        expect(screen.queryByRole('button', { name: 'Show Page Header slot' })).not.toBeInTheDocument()
    })
})

describe('WidgetSlot empty-slot paste paths', () => {
    const renderPasteSlot = (props = {}) => render(
        <WidgetSlot
            name="header"
            label="Page Header"
            description="Site navigation"
            widgets={{}}
            slotMode="edit"
            editable={true}
            pasteModeActive={true}
            {...props}
        />
    )

    it('uses an empty path when pasting into an empty top-level slot', () => {
        const onPasteAtPosition = vi.fn()

        const { container } = renderPasteSlot({ onPasteAtPosition })
        fireEvent.click(container.querySelector('.empty-slot'))

        expect(onPasteAtPosition).toHaveBeenCalledWith('header', 0, [], false)
    })

    it('keeps the full path when pasting into an empty nested slot', () => {
        const onPasteAtPosition = vi.fn()

        const { container } = renderPasteSlot({
            name: 'content',
            label: 'Footer Content',
            widgetPath: ['footer', 'footer-widget-1'],
            onPasteAtPosition,
        })
        fireEvent.click(container.querySelector('.empty-slot'))

        expect(onPasteAtPosition).toHaveBeenCalledWith(
            'content',
            0,
            ['footer', 'footer-widget-1', 'content'],
            false,
        )
    })
})

describe('WidgetSlot database policies', () => {
    it('keeps null widget limits unlimited and forwards disallowed types', () => {
        const onShowWidgetModal = vi.fn()
        const widgets = {
            main: Array.from({ length: 20 }, (_, index) => ({
                id: `widget-${index}`,
                type: 'easy_widgets.ContentWidget',
                config: {},
            })),
        }
        render(
            <WidgetSlot
                name="main"
                label="Main"
                widgets={widgets}
                editable={true}
                slotMode="edit"
                behavior={{
                    allowedWidgetTypes: ['*'],
                    disallowedWidgetTypes: ['easy_widgets.HeaderWidget'],
                    maxWidgets: null,
                }}
                onShowWidgetModal={onShowWidgetModal}
            />
        )

        fireEvent.click(screen.getByTitle('Add widget to slot'))

        expect(onShowWidgetModal).toHaveBeenCalledWith('main', expect.objectContaining({
            disallowedWidgetTypes: ['easy_widgets.HeaderWidget'],
            maxWidgets: null,
        }))
    })
})
