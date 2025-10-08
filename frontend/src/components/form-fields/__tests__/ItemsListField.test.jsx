import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import ItemsListField from '../ItemsListField'
import { UnifiedDataProvider } from '../../../contexts/unified-data/context/UnifiedDataContext'

// Wrapper component for tests with initial UDC state
const TestWrapper = ({ children, initialState }) => (
    <UnifiedDataProvider initialState={initialState}>
        {children}
    </UnifiedDataProvider>
)

// Helper to render with wrapper and optional initial items in UDC
const renderWithUDC = (component, items = []) => {
    const initialState = items.length > 0 ? {
        webpages: {
            page: {
                widgets: {
                    main: {
                        'test-widget': {
                            config: {
                                menu_items: items
                            }
                        }
                    }
                }
            }
        }
    } : undefined

    return render(component, {
        wrapper: ({ children }) => <TestWrapper initialState={initialState}>{children}</TestWrapper>
    })
}

describe('ItemsListField', () => {
    const mockOnChange = vi.fn()

    const defaultItemSchema = {
        type: 'object',
        properties: {
            label: { type: 'string', title: 'Label' },
            url: { type: 'string', title: 'URL' },
            is_active: { type: 'boolean', title: 'Active' }
        }
    }

    const defaultItems = [
        { label: 'Home', url: '/', is_active: true },
        { label: 'About', url: '/about', is_active: false }
    ]

    beforeEach(() => {
        mockOnChange.mockClear()
    })

    it('renders with label', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
            />
        )

        expect(screen.getByText('Menu Items')).toBeInTheDocument()
    })

    it('shows item count', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                context={{ widgetId: 'test-widget', slotName: 'main', contextType: 'page', fieldName: 'menu_items' }}
            />,
            defaultItems
        )

        expect(screen.getByText('2 Items')).toBeInTheDocument()
    })

    it('shows empty state when no items', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                emptyText="No menu items yet"
            />
        )

        expect(screen.getByText('No menu items yet')).toBeInTheDocument()
    })

    it('renders add button', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                addButtonText="Add Menu Item"
            />
        )

        // There are two add buttons: one in header and one in empty state
        const addButtons = screen.getAllByText('Add Menu Item')
        expect(addButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('calls onChange when add button clicked', async () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
            />
        )

        // Get the first add button (header button)
        const addButtons = screen.getAllByText('Add Item')
        fireEvent.click(addButtons[0])

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith([
                expect.objectContaining({})
            ])
        })
    })

    it('displays items with custom label template', () => {
        const itemLabelTemplate = (item) => `${item.label} - ${item.url}`

        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                itemLabelTemplate={itemLabelTemplate}
                context={{ widgetId: 'test-widget', slotName: 'main', contextType: 'page', fieldName: 'menu_items' }}
            />,
            defaultItems
        )

        expect(screen.getByText('Home - /')).toBeInTheDocument()
        expect(screen.getByText('About - /about')).toBeInTheDocument()
    })

    it('shows required indicator when required', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                required={true}
            />
        )

        const requiredIndicator = screen.getByText('*')
        expect(requiredIndicator).toHaveClass('text-red-500')
    })

    it('respects maxItems limit', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                maxItems={2}
            />
        )

        expect(screen.getByText('2 Items (max 2)')).toBeInTheDocument()

        // Add button should not be present when at max
        const addButtons = screen.queryAllByText('Add Item')
        expect(addButtons).toHaveLength(0)
    })

    it('shows validation error', () => {
        const validation = {
            isValid: false,
            errors: ['At least one menu item is required']
        }

        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                validation={validation}
            />
        )

        expect(screen.getByText('At least one menu item is required')).toBeInTheDocument()
    })

    it('disables add button when disabled prop is true', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={[]}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                disabled={true}
            />
        )

        // When disabled, there should be no add buttons visible
        const addButtons = screen.queryAllByRole('button', { name: /add/i })
        expect(addButtons).toHaveLength(0)
    })

    it('allows removing items when allowRemove is true', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                allowRemove={true}
            />
        )

        const removeButtons = screen.getAllByTitle('Remove item')
        expect(removeButtons).toHaveLength(2)
    })

    it('calls onChange when item is removed', async () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                allowRemove={true}
            />
        )

        const removeButtons = screen.getAllByTitle('Remove item')
        fireEvent.click(removeButtons[0])

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith([defaultItems[1]])
        })
    })

    it('expands and collapses items', async () => {
        const itemLabelTemplate = (item) => item.label

        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
                itemLabelTemplate={itemLabelTemplate}
                context={{ widgetId: 'test-widget', slotName: 'main', contextType: 'page', fieldName: 'menu_items' }}
            />,
            defaultItems
        )

        // Initially collapsed
        const homeItem = screen.getByText('Home')
        const expandButton = homeItem.closest('button')

        expect(expandButton).toHaveAttribute('aria-expanded', 'false')

        // Click to expand
        fireEvent.click(expandButton)

        await waitFor(() => {
            expect(expandButton).toHaveAttribute('aria-expanded', 'true')
        })
    })

    it('shows item index', () => {
        renderWithUDC(
            <ItemsListField
                label="Menu Items"
                value={defaultItems}
                onChange={mockOnChange}
                itemSchema={defaultItemSchema}
            />
        )

        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
    })
})
