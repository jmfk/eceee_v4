/**
 * Self-Contained Widget Form Tests
 * 
 * Test suite for the vanilla JS widget form system
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { SelfContainedWidgetForm, WidgetRegistry } from '../SelfContainedWidgetForm.js'

// Mock the API modules
vi.mock('../../api/widgets.js', () => ({
    widgetsApi: {
        update: vi.fn().mockResolvedValue({ success: true })
    }
}))

vi.mock('../../api/widgetSchemas.js', () => ({
    validateWidgetConfiguration: vi.fn().mockResolvedValue({
        is_valid: true,
        errors: {},
        warnings: {}
    }),
    getWidgetSchema: vi.fn().mockResolvedValue({
        type: 'object',
        properties: {
            text: {
                type: 'string',
                title: 'Text',
                description: 'The text to display'
            },
            fontSize: {
                type: 'number',
                title: 'Font Size',
                minimum: 8,
                maximum: 72,
                default: 16
            },
            bold: {
                type: 'boolean',
                title: 'Bold',
                default: false
            }
        },
        required: ['text']
    })
}))

describe('WidgetRegistry', () => {
    let registry

    beforeEach(() => {
        registry = new WidgetRegistry()
    })

    test('should be a singleton', () => {
        const registry1 = new WidgetRegistry()
        const registry2 = new WidgetRegistry()
        expect(registry1).toBe(registry2)
    })

    test('should register and unregister forms', () => {
        const mockForm = {
            widgetId: 'test-widget',
            slotName: 'test-slot'
        }

        registry.register(mockForm)
        expect(registry.widgets.has('test-widget')).toBe(true)

        registry.unregister('test-widget')
        expect(registry.widgets.has('test-widget')).toBe(false)
    })

    test('should broadcast events to listeners', () => {
        const listener = vi.fn()
        const unsubscribe = registry.subscribe('TEST_EVENT', listener)

        registry.broadcast({ type: 'TEST_EVENT', data: 'test' })
        expect(listener).toHaveBeenCalledWith({ type: 'TEST_EVENT', data: 'test' })

        unsubscribe()
        registry.broadcast({ type: 'TEST_EVENT', data: 'test2' })
        expect(listener).toHaveBeenCalledTimes(1) // Should not be called again
    })

    test('should get widget states', () => {
        const mockForm = {
            widgetId: 'test-widget',
            slotName: 'test-slot',
            currentConfig: { text: 'Hello' },
            isDirty: true,
            isValid: true,
            hasUnsavedChanges: true
        }

        registry.register(mockForm)
        const states = registry.getAllWidgetStates()

        expect(states['test-widget']).toEqual({
            config: { text: 'Hello' },
            isDirty: true,
            isValid: true,
            slotName: 'test-slot',
            hasUnsavedChanges: true
        })
    })
})

describe('SelfContainedWidgetForm', () => {
    let container
    let widgetData
    let form

    beforeEach(() => {
        // Create a container element
        container = document.createElement('div')
        document.body.appendChild(container)

        // Mock widget data
        widgetData = {
            id: 'test-widget-123',
            type: 'easy_widgets.TextWidget',
            name: 'Test Widget',
            slotName: 'test-slot',
            config: {
                text: 'Hello World',
                fontSize: 16,
                bold: false
            }
        }

        // Create form instance
        form = new SelfContainedWidgetForm(widgetData, {
            registry: new WidgetRegistry()
        })
    })

    afterEach(() => {
        if (form && !form.isDestroyed) {
            form.destroy()
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container)
        }
    })

    test('should initialize with widget data', () => {
        expect(form.widgetId).toBe('test-widget-123')
        expect(form.widgetType).toBe('easy_widgets.TextWidget')
        expect(form.slotName).toBe('test-slot')
        expect(form.originalConfig).toEqual(widgetData.config)
        expect(form.currentConfig).toEqual(widgetData.config)
    })

    test('should initialize form in container', async () => {
        const success = await form.initialize(container)
        expect(success).toBe(true)
        expect(form.container).toBe(container)
        expect(container.children.length).toBeGreaterThan(0)
    })

    test('should update field values', async () => {
        await form.initialize(container)

        const oldValue = form.currentConfig.text
        form.updateField('text', 'Updated Text')

        expect(form.currentConfig.text).toBe('Updated Text')
        expect(form.isDirty).toBe(true)
        expect(form.hasUnsavedChanges).toBe(true)
    })

    test('should track dirty state correctly', async () => {
        await form.initialize(container)

        expect(form.isDirty).toBe(false)

        form.updateField('text', 'New Text')
        expect(form.isDirty).toBe(true)

        form.updateField('text', 'Hello World') // Back to original
        expect(form.isDirty).toBe(false)
    })

    test('should reset form to original state', async () => {
        await form.initialize(container)

        form.updateField('text', 'Changed Text')
        form.updateField('fontSize', 24)
        expect(form.isDirty).toBe(true)

        form.reset()
        expect(form.currentConfig).toEqual(widgetData.config)
        expect(form.isDirty).toBe(false)
        expect(form.hasUnsavedChanges).toBe(false)
    })

    test('should create appropriate input elements', async () => {
        await form.initialize(container)

        // Should have created input elements for each field
        expect(form.fieldElements.has('text')).toBe(true)
        expect(form.fieldElements.has('fontSize')).toBe(true)
        expect(form.fieldElements.has('bold')).toBe(true)

        // Check input types
        const textInput = form.fieldElements.get('text')
        const fontSizeInput = form.fieldElements.get('fontSize')
        const boldInput = form.fieldElements.get('bold')

        expect(textInput.type).toBe('text')
        expect(fontSizeInput.type).toBe('number')
        expect(boldInput.type).toBe('checkbox')
    })

    test('should handle field value retrieval correctly', async () => {
        await form.initialize(container)

        const textInput = form.fieldElements.get('text')
        const fontSizeInput = form.fieldElements.get('fontSize')
        const boldInput = form.fieldElements.get('bold')

        // Test string value
        textInput.value = 'Test Value'
        expect(form.getFieldValue(textInput)).toBe('Test Value')

        // Test number value
        fontSizeInput.value = '24'
        expect(form.getFieldValue(fontSizeInput)).toBe(24)

        // Test boolean value
        boldInput.checked = true
        expect(form.getFieldValue(boldInput)).toBe(true)
    })

    test('should destroy cleanly', async () => {
        await form.initialize(container)

        expect(form.isDestroyed).toBe(false)
        expect(container.children.length).toBeGreaterThan(0)

        form.destroy()

        expect(form.isDestroyed).toBe(true)
        expect(form.fieldElements.size).toBe(0)
        expect(form.validationElements.size).toBe(0)
    })

    test('should notify registry of events', async () => {
        const registry = new WidgetRegistry()
        const listener = vi.fn()
        registry.subscribe('CONFIG_CHANGE', listener)

        const formWithRegistry = new SelfContainedWidgetForm(widgetData, {
            registry
        })

        await formWithRegistry.initialize(container)
        formWithRegistry.updateField('text', 'New Text')

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'CONFIG_CHANGE',
                widgetId: 'test-widget-123',
                slotName: 'test-slot',
                fieldName: 'text',
                value: 'New Text'
            })
        )

        formWithRegistry.destroy()
    })

    test('should get current state', async () => {
        await form.initialize(container)
        form.updateField('text', 'Modified Text')

        const state = form.getState()

        expect(state).toEqual({
            widgetId: 'test-widget-123',
            widgetType: 'easy_widgets.TextWidget',
            slotName: 'test-slot',
            originalConfig: widgetData.config,
            currentConfig: expect.objectContaining({
                text: 'Modified Text'
            }),
            isDirty: true,
            isValid: true,
            hasUnsavedChanges: true,
            isValidating: false
        })
    })
})

describe('Form Field Creation', () => {
    let form
    let container

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)

        form = new SelfContainedWidgetForm({
            id: 'test',
            type: 'test.Widget',
            slotName: 'test',
            config: {}
        })
    })

    afterEach(() => {
        if (form && !form.isDestroyed) {
            form.destroy()
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container)
        }
    })

    test('should create text input for string fields', () => {
        const fieldSchema = { type: 'string', title: 'Text Field' }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.type).toBe('text')
        expect(input.name).toBe('testField')
    })

    test('should create textarea for textarea format', () => {
        const fieldSchema = { type: 'string', format: 'textarea', title: 'Text Area' }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.tagName).toBe('TEXTAREA')
        expect(input.name).toBe('testField')
    })

    test('should create number input for number fields', () => {
        const fieldSchema = { type: 'number', title: 'Number Field', minimum: 0, maximum: 100 }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.type).toBe('number')
        expect(input.min).toBe('0')
        expect(input.max).toBe('100')
    })

    test('should create checkbox for boolean fields', () => {
        const fieldSchema = { type: 'boolean', title: 'Boolean Field' }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.type).toBe('checkbox')
    })

    test('should create select for enum fields', () => {
        const fieldSchema = {
            type: 'string',
            enum: ['option1', 'option2', 'option3'],
            title: 'Select Field'
        }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.tagName).toBe('SELECT')
        expect(input.options.length).toBe(3)
        expect(input.options[0].value).toBe('option1')
    })

    test('should create email input for email format', () => {
        const fieldSchema = { type: 'string', format: 'email', title: 'Email Field' }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.type).toBe('email')
    })

    test('should create color input for color format', () => {
        const fieldSchema = { type: 'string', format: 'color', title: 'Color Field' }
        const input = form.createInputElement('testField', fieldSchema)

        expect(input.type).toBe('color')
    })
})
