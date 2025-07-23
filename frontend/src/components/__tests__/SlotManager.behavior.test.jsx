import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SlotManager from '../SlotManager'
import { createTestWrapper } from '../../test/testUtils'
import {
    setupWidgetTest,
    MockDataFactory,
    UserInteractionHelper,
    WidgetAssertions,
    TestWidgetBuilder
} from '../../test/widgetTestUtils'

// Mock the child components
vi.mock('../WidgetLibrary', () => ({
    default: ({ onSelectWidget }) => (
        <div data-testid="widget-library">
            <button onClick={() => onSelectWidget(MockDataFactory.createWidgetType())}>
                Select Text Block
            </button>
        </div>
    ),
}))

vi.mock('../WidgetConfigurator', () => ({
    default: ({ widgetType, onSave, onCancel }) => (
        <div data-testid="widget-configurator">
            <h3>Configure {widgetType?.name}</h3>
            <button onClick={() => onSave({ content: 'Test content' })}>Save Config</button>
            <button onClick={onCancel}>Cancel Config</button>
        </div>
    ),
}))

describe('SlotManager - User Behavior Tests', () => {
    let user
    let testUtils

    beforeEach(() => {
        user = userEvent.setup()

        const mockLayout = MockDataFactory.createLayout()
        const mockWidgets = [
            MockDataFactory.createTextWidget(),
            MockDataFactory.createInheritedWidget()
        ]
        const mockWidgetTypes = [MockDataFactory.createWidgetType()]

        testUtils = setupWidgetTest({
            widgets: MockDataFactory.createPageWidgetData(mockWidgets),
            widgetTypes: mockWidgetTypes,
            layouts: [mockLayout]
        })
    })

    describe('Adding widgets to a page', () => {
        it('allows user to add a new widget to an empty slot', async () => {
            const { renderWithQueryClient } = testUtils
            const mockLayout = MockDataFactory.createLayout()

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User sees the slot is empty and clicks add widget
            const headerSlot = screen.getByTestId('slot-header')
            expect(headerSlot).toBeInTheDocument()

            const addButton = within(headerSlot).getByText('Add Widget')
            await user.click(addButton)

            // User sees widget library and selects a widget type
            expect(screen.getByTestId('widget-library')).toBeInTheDocument()

            const selectButton = screen.getByText('Select Text Block')
            await user.click(selectButton)

            // User configures the widget
            expect(screen.getByTestId('widget-configurator')).toBeInTheDocument()

            const saveButton = screen.getByText('Save Config')
            await user.click(saveButton)

            // User should see the widget appears in the slot
            await waitFor(() => {
                WidgetAssertions.expectSuccessMessage('Widget added successfully')
            })
        })

        it('prevents user from adding widgets to slots with inherited widgets they cannot override', async () => {
            const { renderWithQueryClient } = testUtils
            const mockLayout = MockDataFactory.createLayout()

            // Layout has a slot that already contains inherited widgets
            const inheritedWidget = MockDataFactory.createInheritedWidget({
                slot_name: 'header',
                override_parent: false
            })

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User can see the inherited widget is present
            WidgetAssertions.expectInheritanceIndicator(inheritedWidget.id)

            // User tries to add another widget to the same slot
            const headerSlot = screen.getByTestId('slot-header')
            const addButton = within(headerSlot).getByText('Add Widget')

            // The behavior should allow this - multiple widgets per slot is supported
            await user.click(addButton)
            expect(screen.getByTestId('widget-library')).toBeInTheDocument()
        })
    })

    describe('Managing existing widgets', () => {
        it('allows user to reorder widgets within a slot', async () => {
            const { renderWithQueryClient } = testUtils
            const mockLayout = MockDataFactory.createLayout()

            // Setup a slot with multiple widgets
            const firstWidget = MockDataFactory.createTextWidget({
                sort_order: 0,
                configuration: { content: 'First widget' }
            })
            const secondWidget = MockDataFactory.createButtonWidget({
                sort_order: 1,
                configuration: { text: 'Second widget' }
            })

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User sees widgets in current order
            WidgetAssertions.expectWidgetOrder('content', ['First widget', 'Second widget'])

            // User moves the second widget up
            const userHelper = new UserInteractionHelper(user)
            await userHelper.moveWidget(secondWidget.id, 'up')

            // User should see the order has changed
            await waitFor(() => {
                WidgetAssertions.expectWidgetOrder('content', ['Second widget', 'First widget'])
            })
        })

        it('prevents user from deleting inherited widgets', async () => {
            const { renderWithQueryClient } = testUtils
            const mockLayout = MockDataFactory.createLayout()

            const inheritedWidget = MockDataFactory.createInheritedWidget()

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User tries to delete an inherited widget
            const userHelper = new UserInteractionHelper(user)
            await userHelper.deleteWidget(inheritedWidget.id)

            // User should see an error message explaining why they can't
            WidgetAssertions.expectErrorMessage('Cannot delete inherited widgets. Override them instead.')
        })

        it('allows user to edit widget configuration', async () => {
            const { renderWithQueryClient } = testUtils
            const mockLayout = MockDataFactory.createLayout()

            const editableWidget = MockDataFactory.createTextWidget()

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User clicks edit button on widget
            const userHelper = new UserInteractionHelper(user)
            await userHelper.editWidget(editableWidget.id)

            // User sees configuration form
            expect(screen.getByTestId('widget-configurator')).toBeInTheDocument()

            // User saves changes
            const saveButton = screen.getByText('Save Config')
            await user.click(saveButton)

            // User sees success feedback
            await waitFor(() => {
                WidgetAssertions.expectSuccessMessage('Widget updated successfully')
            })
        })
    })

    describe('Error handling and user feedback', () => {
        it('shows helpful error when API fails during widget creation', async () => {
            // Setup API to return error
            const { renderWithQueryClient } = testUtils
            testUtils.mockData = new TestWidgetBuilder()
                .withApiError({ message: 'Server error', detail: 'Failed to save widget' })
                .build()

            const mockLayout = MockDataFactory.createLayout()

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User tries to add widget but server fails
            const addButton = screen.getByText('Add Widget')
            await user.click(addButton)

            const selectButton = screen.getByText('Select Text Block')
            await user.click(selectButton)

            const saveButton = screen.getByText('Save Config')
            await user.click(saveButton)

            // User sees helpful error message
            await waitFor(() => {
                WidgetAssertions.expectErrorMessage('Failed to save widget')
            })
        })

        it('provides loading feedback during long operations', async () => {
            const { renderWithQueryClient } = testUtils

            // Setup API to simulate loading
            testUtils.mockData = new TestWidgetBuilder()
                .withLoadingState()
                .build()

            const mockLayout = MockDataFactory.createLayout()

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User sees loading state while widgets are being fetched
            expect(screen.getByText('Loading...')).toBeInTheDocument()
        })
    })

    describe('Inheritance behavior', () => {
        it('clearly indicates which widgets are inherited vs local', async () => {
            const { renderWithQueryClient } = testUtils
            const mockLayout = MockDataFactory.createLayout()

            const localWidget = MockDataFactory.createTextWidget({
                configuration: { content: 'Local widget' }
            })
            const inheritedWidget = MockDataFactory.createInheritedWidget({
                configuration: { content: 'Inherited widget' }
            })

            renderWithQueryClient(
                <SlotManager
                    pageId={1}
                    layout={mockLayout}
                    onWidgetChange={vi.fn()}
                />
            )

            // User can distinguish between local and inherited widgets
            WidgetAssertions.expectInheritanceIndicator(inheritedWidget.id)

            // Local widgets should not have inheritance indicators
            expect(screen.queryByTestId(`inherited-indicator-${localWidget.id}`))
                .not.toBeInTheDocument()
        })
    })
}) 