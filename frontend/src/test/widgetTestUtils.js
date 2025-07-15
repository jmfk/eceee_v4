/**
 * Widget testing utilities
 * Following Sandi Metz principle: "Extract common patterns into shared utilities"
 */

import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import axios from 'axios'

/**
 * Test widget builder for creating mock widget data
 */
export class TestWidgetBuilder {
    constructor() {
        this.widgets = []
        this.widgetTypes = []
        this.pages = []
        this.layouts = []
    }

    withMockWidgets(widgets) {
        this.widgets = widgets
        return this
    }

    withMockWidgetTypes(widgetTypes) {
        this.widgetTypes = widgetTypes
        return this
    }

    withMockPages(pages) {
        this.pages = pages
        return this
    }

    withMockLayouts(layouts) {
        this.layouts = layouts
        return this
    }

    withApiError(error) {
        this.apiError = error
        return this
    }

    withLoadingState() {
        this.isLoading = true
        return this
    }

    build() {
        // Setup axios mocks based on builder state
        if (this.apiError) {
            this.setupApiError()
        } else if (this.isLoading) {
            this.setupLoadingState()
        } else {
            this.setupSuccessfulApi()
        }

        return {
            widgets: this.widgets,
            widgetTypes: this.widgetTypes,
            pages: this.pages,
            layouts: this.layouts
        }
    }

    setupSuccessfulApi() {
        axios.get.mockImplementation((url) => {
            if (url.includes('/api/webpages/api/widgets/by_page/')) {
                return Promise.resolve({ data: { widgets: this.widgets } })
            }
            if (url.includes('/api/webpages/api/widget-types/')) {
                return Promise.resolve({ data: this.widgetTypes })
            }
            if (url.includes('/api/webpages/api/webpages/')) {
                return Promise.resolve({ data: this.pages })
            }
            if (url.includes('/api/webpages/api/layouts/')) {
                return Promise.resolve({ data: this.layouts })
            }
            return Promise.reject(new Error('Unknown endpoint'))
        })

        axios.post.mockResolvedValue({ data: { id: 999, success: true } })
        axios.patch.mockResolvedValue({ data: { success: true } })
        axios.delete.mockResolvedValue({ data: { success: true } })
    }

    setupApiError() {
        const error = new Error(this.apiError.message || 'API Error')
        error.response = { data: { detail: this.apiError.detail || 'Test error' } }

        axios.get.mockRejectedValue(error)
        axios.post.mockRejectedValue(error)
        axios.patch.mockRejectedValue(error)
        axios.delete.mockRejectedValue(error)
    }

    setupLoadingState() {
        // Return a promise that never resolves to simulate loading
        const neverResolve = () => new Promise(() => { })

        axios.get.mockImplementation(neverResolve)
        axios.post.mockImplementation(neverResolve)
        axios.patch.mockImplementation(neverResolve)
        axios.delete.mockImplementation(neverResolve)
    }
}

/**
 * Mock data factories for common widget testing scenarios
 */
export const MockDataFactory = {
    createTextWidget: (overrides = {}) => ({
        id: 1,
        widget_type: { id: 1, name: 'Text Block' },
        slot_name: 'content',
        sort_order: 0,
        configuration: { content: 'Test text content', alignment: 'left' },
        is_inherited: false,
        inherited_from: null,
        ...overrides
    }),

    createButtonWidget: (overrides = {}) => ({
        id: 2,
        widget_type: { id: 2, name: 'Button' },
        slot_name: 'content',
        sort_order: 1,
        configuration: { text: 'Click me', url: 'https://example.com', style: 'primary' },
        is_inherited: false,
        inherited_from: null,
        ...overrides
    }),

    createInheritedWidget: (overrides = {}) => ({
        id: 3,
        widget_type: { id: 1, name: 'Text Block' },
        slot_name: 'header',
        sort_order: 0,
        configuration: { content: 'Inherited content' },
        is_inherited: true,
        inherited_from: 'Parent Page',
        ...overrides
    }),

    createWidgetType: (overrides = {}) => ({
        id: 1,
        name: 'Text Block',
        description: 'Rich text content block',
        is_active: true,
        json_schema: {
            type: 'object',
            properties: {
                content: { type: 'string', title: 'Content' }
            },
            required: ['content']
        },
        ...overrides
    }),

    createLayout: (overrides = {}) => ({
        id: 1,
        name: 'Test Layout',
        description: 'A test layout',
        slot_configuration: {
            slots: [
                { name: 'header', display_name: 'Header', description: 'Header slot' },
                { name: 'content', display_name: 'Content', description: 'Main content' }
            ]
        },
        ...overrides
    }),

    createPageWidgetData: (widgets = []) =>
        widgets.map(widget => ({
            widget,
            inherited_from: widget.inherited_from
        }))
}

/**
 * User interaction utilities for behavior-focused testing
 */
export class UserInteractionHelper {
    constructor(user) {
        this.user = user
    }

    async addWidgetToSlot(slotName, widgetTypeName) {
        // Simulate user journey: click add button -> select widget -> configure -> save
        const addButton = screen.getByText(`Add Widget`)
        await this.user.click(addButton)

        const widgetOption = screen.getByText(widgetTypeName)
        await this.user.click(widgetOption)

        return this
    }

    async configureWidget(config) {
        // Fill out widget configuration form
        for (const [field, value] of Object.entries(config)) {
            const input = screen.getByLabelText(new RegExp(field, 'i'))
            await this.user.clear(input)
            await this.user.type(input, value)
        }

        const saveButton = screen.getByText('Save')
        await this.user.click(saveButton)

        return this
    }

    async editWidget(widgetId) {
        const editButton = screen.getByTestId(`edit-widget-${widgetId}`)
        await this.user.click(editButton)
        return this
    }

    async deleteWidget(widgetId) {
        const deleteButton = screen.getByTestId(`delete-widget-${widgetId}`)
        await this.user.click(deleteButton)
        return this
    }

    async moveWidget(widgetId, direction) {
        const moveButton = screen.getByTestId(`move-${direction}-${widgetId}`)
        await this.user.click(moveButton)
        return this
    }
}

/**
 * Component wrapper with React Query provider
 */
export function renderWithQueryClient(ui, options = {}) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    const Wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

    return {
        ...render(ui, { wrapper: Wrapper, ...options }),
        queryClient
    }
}

/**
 * Assertion helpers for widget behavior
 */
export const WidgetAssertions = {
    expectWidgetInSlot: (slotName, widgetText) => {
        const slot = screen.getByTestId(`slot-${slotName}`)
        expect(within(slot).getByText(widgetText)).toBeInTheDocument()
    },

    expectWidgetNotInSlot: (slotName, widgetText) => {
        const slot = screen.getByTestId(`slot-${slotName}`)
        expect(within(slot).queryByText(widgetText)).not.toBeInTheDocument()
    },

    expectInheritanceIndicator: (widgetId) => {
        expect(screen.getByTestId(`inherited-indicator-${widgetId}`)).toBeInTheDocument()
    },

    expectWidgetOrder: (slotName, expectedOrder) => {
        const slot = screen.getByTestId(`slot-${slotName}`)
        const widgets = within(slot).getAllByTestId(/^widget-/)

        expectedOrder.forEach((expectedText, index) => {
            expect(within(widgets[index]).getByText(expectedText)).toBeInTheDocument()
        })
    },

    expectErrorMessage: (message) => {
        expect(screen.getByText(message)).toBeInTheDocument()
    },

    expectSuccessMessage: (message) => {
        expect(screen.getByText(message)).toBeInTheDocument()
    }
}

/**
 * Setup function for widget component tests
 */
export function setupWidgetTest(testData = {}) {
    const mockData = new TestWidgetBuilder()
        .withMockWidgets(testData.widgets || [])
        .withMockWidgetTypes(testData.widgetTypes || [])
        .withMockLayouts(testData.layouts || [])
        .build()

    return {
        mockData,
        MockDataFactory,
        UserInteractionHelper,
        WidgetAssertions,
        renderWithQueryClient
    }
}

// Mock setup function to call before each test
export function setupWidgetMocks() {
    vi.mock('axios')
    vi.mock('react-hot-toast', () => ({
        default: {
            success: vi.fn(),
            error: vi.fn(),
        },
    }))
} 