import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetConfigurator from '../WidgetConfigurator'

// Mock widget types for new code-based system
const mockTextBlockWidget = {
    name: "Text Block",
    description: "A simple text content widget",
    template_name: "webpages/widgets/text_block.html",
    is_active: true,
    configuration_schema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Optional title for the text block",
                default: ""
            },
            content: {
                type: "string",
                description: "Main text content"
            },
            alignment: {
                type: "string",
                enum: ["left", "center", "right", "justify"],
                default: "left",
                description: "Text alignment"
            },
            style: {
                type: "string",
                enum: ["normal", "emphasized", "quote"],
                default: "normal",
                description: "Text style"
            }
        },
        required: ["content"]
    }
}

const mockButtonWidget = {
    name: "Button",
    description: "Interactive button widget",
    template_name: "webpages/widgets/button.html",
    is_active: true,
    configuration_schema: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "Button text"
            },
            url: {
                type: "string",
                description: "Target URL"
            },
            style: {
                type: "string",
                enum: ["primary", "secondary", "outline"],
                default: "primary",
                description: "Button style"
            },
            size: {
                type: "string",
                enum: ["small", "medium", "large"],
                default: "medium",
                description: "Button size"
            },
            height: {
                type: "number",
                minimum: 20,
                maximum: 100,
                default: 40,
                description: "Button height in pixels"
            }
        },
        required: ["text", "url"]
    }
}

const mockImageWidget = {
    name: "Image",
    description: "Display an image with optional caption",
    template_name: "webpages/widgets/image.html",
    is_active: true,
    configuration_schema: {
        type: "object",
        properties: {
            image_url: {
                type: "string",
                description: "Image URL"
            },
            alt_text: {
                type: "string",
                description: "Alt text for accessibility"
            },
            caption: {
                type: "string",
                description: "Optional image caption",
                default: ""
            }
        },
        required: ["image_url", "alt_text"]
    }
}

describe('WidgetConfigurator', () => {
    const defaultProps = {
        onSave: vi.fn(),
        onCancel: vi.fn(),
        title: "Configure Widget",
        showInheritanceControls: true,
        isEditing: false
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without widget type', () => {
        render(<WidgetConfigurator {...defaultProps} />)

        expect(screen.getByText('No widget type selected')).toBeInTheDocument()
    })

    it('renders widget configuration form for text block', async () => {
        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Configure Widget')).toBeInTheDocument()
            expect(screen.getByText((content, element) => {
                return content.includes('Configuring:') && content.includes('Text Block')
            })).toBeInTheDocument()
        })

        // Should render form fields based on schema
        expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: /alignment/i })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: /style/i })).toBeInTheDocument()
    })

    it('calls onSave with valid configuration', async () => {
        const user = userEvent.setup()
        const mockOnSave = vi.fn()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                onSave={mockOnSave}
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument()
        })

        // Fill in required field
        const contentInput = screen.getByRole('textbox', { name: /content/i })
        await user.type(contentInput, 'Test content')

        const saveButton = screen.getByRole('button', { name: /save configuration/i })
        await user.click(saveButton)

        expect(mockOnSave).toHaveBeenCalledWith(
            expect.objectContaining({
                configuration: expect.objectContaining({
                    content: 'Test content'
                })
            })
        )
    })

    it('calls onSave with configuration only when inheritance controls disabled', async () => {
        const user = userEvent.setup()
        const mockOnSave = vi.fn()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                onSave={mockOnSave}
                showInheritanceControls={false}
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument()
        })

        const contentInput = screen.getByRole('textbox', { name: /content/i })
        await user.type(contentInput, 'Test content')

        const saveButton = screen.getByRole('button', { name: /save configuration/i })
        await user.click(saveButton)

        // Should return just the configuration object, not wrapped in additional properties
        expect(mockOnSave).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'Test content',
                alignment: 'left',  // Default value
                style: 'normal'     // Default value
            })
        )
    })

    it('validates required fields', async () => {
        const user = userEvent.setup()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument()
        })

        // Try to save without filling required content field
        const saveButton = screen.getByRole('button', { name: /save configuration/i })
        await user.click(saveButton)

        // Should show validation error
        await waitFor(() => {
            expect(screen.getByText(/please fix the following errors/i)).toBeInTheDocument()
        })
    })

    it('disables save button when form is invalid', async () => {
        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                initialConfig={{}} // Empty config should be invalid
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument()
        })

        const saveButton = screen.getByRole('button', { name: /save configuration/i })

        // Button should be disabled since form is invalid (missing required content field)
        expect(saveButton).toBeDisabled()
    })

    it('enables save button when form is valid', async () => {
        const user = userEvent.setup()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument()
        })

        // Fill required field
        const contentInput = screen.getByRole('textbox', { name: /content/i })
        await user.type(contentInput, 'Valid content')

        const saveButton = screen.getByRole('button', { name: /save configuration/i })
        expect(saveButton).toBeEnabled()
    })

    it('shows validation summary for multiple errors', async () => {
        const user = userEvent.setup()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockButtonWidget}
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument()
        })

        // Try to save without filling required fields (text and url)
        const saveButton = screen.getByRole('button', { name: /save configuration/i })
        await user.click(saveButton)

        await waitFor(() => {
            expect(screen.getByText(/please fix the following errors/i)).toBeInTheDocument()
        })
    })

    it('handles different field types correctly', async () => {
        const user = userEvent.setup()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockButtonWidget}
            />
        )

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /^text/i })).toBeInTheDocument()
        })

        // Test different input types
        const textInput = screen.getByRole('textbox', { name: /^text/i }) // Match "text" field specifically
        const urlInput = screen.getByRole('textbox', { name: /url/i })
        const styleSelect = screen.getByRole('combobox', { name: /style/i })
        const heightInput = screen.getByRole('spinbutton', { name: /height/i })

        await user.type(textInput, 'Click me')
        await user.type(urlInput, 'https://example.com')
        await user.selectOptions(styleSelect, 'secondary')
        await user.clear(heightInput)
        await user.type(heightInput, '50')

        expect(textInput).toHaveValue('Click me')
        expect(urlInput).toHaveValue('https://example.com')
        expect(styleSelect).toHaveValue('secondary')
        expect(heightInput).toHaveValue(50)
    })

    it('loads initial configuration values', () => {
        const initialConfig = {
            content: 'Initial content',
            alignment: 'center',
            style: 'emphasized'
        }

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                initialConfig={initialConfig}
            />
        )

        expect(screen.getByDisplayValue('Initial content')).toBeInTheDocument()
        expect(screen.getByDisplayValue('center')).toBeInTheDocument()
        expect(screen.getByDisplayValue('emphasized')).toBeInTheDocument()
    })

    it('calls onCancel when cancel button is clicked', async () => {
        const user = userEvent.setup()
        const mockOnCancel = vi.fn()

        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                onCancel={mockOnCancel}
            />
        )

        const cancelButton = screen.getByRole('button', { name: /cancel/i })
        await user.click(cancelButton)

        expect(mockOnCancel).toHaveBeenCalled()
    })

    it('shows inheritance controls when enabled', () => {
        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                showInheritanceControls={true}
            />
        )

        expect(screen.getByText('Inheritance')).toBeInTheDocument()
    })

    it('hides inheritance controls when disabled', () => {
        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                showInheritanceControls={false}
            />
        )

        expect(screen.queryByText('Inheritance')).not.toBeInTheDocument()
    })

    it('shows editing mode in title', () => {
        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
                isEditing={true}
                title="Edit Widget"
            />
        )

        expect(screen.getByText('Edit Widget')).toBeInTheDocument()
    })

    it('applies default values from schema', async () => {
        render(
            <WidgetConfigurator
                {...defaultProps}
                widgetType={mockTextBlockWidget}
            />
        )

        await waitFor(() => {
            // Default values should be applied
            expect(screen.getByDisplayValue('left')).toBeInTheDocument() // alignment default
            expect(screen.getByDisplayValue('normal')).toBeInTheDocument() // style default
        })
    })
}) 