import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WidgetSlot from '../WidgetSlot'

vi.mock('../../../editors/page-editor/PageWidgetFactory', () => ({
    default: ({ widget, mode, showControls }) => (
        <div data-testid="rendered-widget" data-mode={mode} data-show-controls={String(showControls)}>
            {widget.type}
        </div>
    )
}))

describe('WidgetSlot preview defaults', () => {
    it('keeps edit controls out of the slot layout flow', () => {
        const { container } = render(
            <WidgetSlot
                name="main"
                label="Main Content"
                widgets={{
                    main: [{ id: 'widget-1', type: 'easy_widgets.ContentWidget', config: {} }],
                }}
                slotMode="edit"
                editable={true}
            />
        )

        const slot = container.querySelector('.widget-slot')
        expect(slot).toHaveAttribute('tabindex', '0')
        expect(slot).toHaveAttribute('role', 'group')
        expect(slot).toHaveAttribute('aria-label', 'Main Content slot')
        expect(slot.querySelector(':scope > .editor-slot-toolbar')).toHaveClass('editor-overlay-toolbar')
        expect(screen.getByTestId('rendered-widget').parentElement).toBe(slot)
    })

    it.each(['header', 'navbar', 'hero', 'footer'])(
        'enters preview mode when %s content arrives after the first render',
        (slotName) => {
            const props = {
                name: slotName,
                label: slotName,
                widgets: {},
                inheritedWidgets: {},
                slotInheritanceRules: {},
                behavior: {
                    slotType: 'inherited',
                    inheritanceAllowed: true,
                    collapseBehavior: 'any',
                },
                editable: true,
            }
            const { rerender } = render(<WidgetSlot {...props} />)

            expect(screen.getByTitle('Preview entire slot')).toBeInTheDocument()

            rerender(
                <WidgetSlot
                    {...props}
                    inheritedWidgets={{
                        [slotName]: [{
                            id: `${slotName}-widget`,
                            type: `easy_widgets.${slotName}Widget`,
                            config: {},
                        }],
                    }}
                />
            )

            expect(screen.getByTestId('rendered-widget')).toHaveAttribute('data-mode', 'display')
            expect(screen.getByTestId('rendered-widget')).toHaveAttribute('data-show-controls', 'false')
            expect(screen.getByTitle('Exit slot preview mode')).toBeInTheDocument()
        }
    )

    it('preserves an explicit edit choice when async slot content changes again', () => {
        const inheritedWidget = {
            id: 'header-widget',
            type: 'easy_widgets.HeaderWidget',
            config: {},
        }
        const props = {
            name: 'header',
            label: 'Header',
            widgets: {},
            inheritedWidgets: { header: [inheritedWidget] },
            slotInheritanceRules: {
                header: {
                    inheritanceAllowed: true,
                    collapseBehavior: 'any',
                },
            },
            editable: true,
        }
        const { rerender } = render(<WidgetSlot {...props} />)

        fireEvent.click(screen.getByTitle('Exit slot preview mode'))
        expect(screen.getByTestId('rendered-widget')).toHaveAttribute('data-mode', 'editor')

        rerender(
            <WidgetSlot
                {...props}
                inheritedWidgets={{
                    header: [
                        inheritedWidget,
                        { id: 'header-widget-2', type: 'easy_widgets.HeaderWidget', config: {} },
                    ],
                }}
            />
        )

        expect(screen.getAllByTestId('rendered-widget')).toHaveLength(2)
        expect(screen.getAllByTestId('rendered-widget')[0]).toHaveAttribute('data-mode', 'editor')
    })
})

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
