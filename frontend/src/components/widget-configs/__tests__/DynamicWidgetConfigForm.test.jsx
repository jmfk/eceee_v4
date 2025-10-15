import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DynamicWidgetConfigForm from '../DynamicWidgetConfigForm'
import * as WidgetConfigRegistry from '../WidgetConfigRegistry'

// Mock the registry
vi.mock('../WidgetConfigRegistry', () => ({
    initializeWidgetConfigRegistry: vi.fn(),
    getWidgetSchema: vi.fn(),
    isWidgetConfigRegistryInitialized: vi.fn()
}))

describe('DynamicWidgetConfigForm', () => {
    const mockSchema = {
        widget_type: 'test.TestWidget',
        widget_name: 'Test Widget',
        fields: {
            title: {
                name: 'title',
                type: 'str',
                required: true,
                description: 'Widget title',
                ui: {
                    component: 'TextInput',
                    placeholder: 'Enter title...'
                }
            },
            enabled: {
                name: 'enabled',
                type: 'bool',
                required: false,
                description: 'Enable widget',
                ui: {
                    component: 'BooleanInput'
                }
            },
            count: {
                name: 'count',
                type: 'int',
                required: false,
                description: 'Item count',
                ui: {
                    component: 'SliderInput',
                    min: 1,
                    max: 10,
                    step: 1
                },
                minimum: 1,
                maximum: 10
            }
        },
        defaults: {
            title: '',
            enabled: false,
            count: 5
        },
        required: ['title']
    }

    beforeEach(() => {
        vi.clearAllMocks()
        WidgetConfigRegistry.isWidgetConfigRegistryInitialized.mockReturnValue(true)
        WidgetConfigRegistry.getWidgetSchema.mockReturnValue(mockSchema)
    })

    it('renders loading state initially', () => {
        WidgetConfigRegistry.isWidgetConfigRegistryInitialized.mockReturnValue(false)
        WidgetConfigRegistry.initializeWidgetConfigRegistry.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 100))
        )

        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={vi.fn()}
            />
        )

        expect(screen.getByText(/Loading configuration/i)).toBeInTheDocument()
    })

    it('renders form fields based on schema', async () => {
        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={vi.fn()}
            />
        )

        await waitFor(() => {
            expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
            expect(screen.getByLabelText(/enabled/i)).toBeInTheDocument()
            expect(screen.getByLabelText(/count/i)).toBeInTheDocument()
        })
    })

    it('calls onChange when field values change', async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()

        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={onChange}
            />
        )

        await waitFor(() => {
            expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
        })

        const titleInput = screen.getByLabelText(/title/i)
        await user.type(titleInput, 'My Title')

        expect(onChange).toHaveBeenCalled()
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ title: expect.stringContaining('My Title') })
        )
    })

    it('shows JSON toggle when enabled', async () => {
        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={vi.fn()}
                showJsonToggle={true}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Form')).toBeInTheDocument()
            expect(screen.getByText('JSON')).toBeInTheDocument()
        })
    })

    it('hides JSON toggle when disabled', async () => {
        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={vi.fn()}
                showJsonToggle={false}
            />
        )

        await waitFor(() => {
            expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
        })

        expect(screen.queryByText('JSON')).not.toBeInTheDocument()
    })

    it('switches between form and JSON view', async () => {
        const user = userEvent.setup()

        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{ title: 'Test' }}
                onChange={vi.fn()}
                showJsonToggle={true}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Form')).toBeInTheDocument()
        })

        const jsonButton = screen.getByText('JSON')
        await user.click(jsonButton)

        await waitFor(() => {
            expect(screen.getByText(/Configuration JSON/i)).toBeInTheDocument()
            expect(screen.getByRole('textbox', { name: /Configuration JSON/i })).toBeInTheDocument()
        })
    })

    it('handles errors gracefully', async () => {
        WidgetConfigRegistry.getWidgetSchema.mockReturnValue(null)

        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={vi.fn()}
            />
        )

        await waitFor(() => {
            expect(screen.getByText(/No configuration available/i)).toBeInTheDocument()
        })
    })

    it('disables fields when disabled prop is true', async () => {
        render(
            <DynamicWidgetConfigForm
                widgetType="test.TestWidget"
                config={{}}
                onChange={vi.fn()}
                disabled={true}
            />
        )

        await waitFor(() => {
            expect(screen.getByLabelText(/title/i)).toBeDisabled()
        })
    })
})

