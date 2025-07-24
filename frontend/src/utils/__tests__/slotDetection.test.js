import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import HtmlSlotDetector, {
    HtmlSlot,
    detectSlotsFromHTML,
    validateSlotName,
    getSlotConfigFromElement,
    createSlotElement
} from '../slotDetection'

// Mock DOM environment
class MockMutationObserver {
    constructor(callback) {
        this.callback = callback
        this.isObserving = false
    }

    observe() {
        this.isObserving = true
    }

    disconnect() {
        this.isObserving = false
    }
}

global.MutationObserver = MockMutationObserver

describe('HtmlSlot', () => {
    let mockElement

    beforeEach(() => {
        mockElement = {
            nodeType: 1, // Element node
            getAttribute: vi.fn(),
            setAttribute: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn()
            },
            className: ''
        }
    })

    describe('constructor and validation', () => {
        it('should create valid slot with proper name', () => {
            const slot = new HtmlSlot(mockElement, 'header')

            expect(slot.name).toBe('header')
            expect(slot.element).toBe(mockElement)
            expect(slot.isValid).toBe(true)
            expect(slot.errors).toHaveLength(0)
        })

        it('should validate slot name length', () => {
            const shortSlot = new HtmlSlot(mockElement, 'a')
            expect(shortSlot.isValid).toBe(false)
            expect(shortSlot.errors).toContain('Slot name must be at least 2 characters')

            const longName = 'a'.repeat(51)
            const longSlot = new HtmlSlot(mockElement, longName)
            expect(longSlot.isValid).toBe(false)
            expect(longSlot.errors).toContain('Slot name cannot exceed 50 characters')
        })

        it('should validate slot name pattern', () => {
            const invalidSlot = new HtmlSlot(mockElement, '123invalid')
            expect(invalidSlot.isValid).toBe(false)
            expect(invalidSlot.errors).toContain('Slot name must start with a letter and contain only letters, numbers, hyphens, and underscores')

            const validSlot = new HtmlSlot(mockElement, 'valid-slot_123')
            expect(validSlot.isValid).toBe(true)
        })

        it('should warn about reserved names', () => {
            const reservedSlot = new HtmlSlot(mockElement, 'main')
            expect(reservedSlot.warnings).toContain('Slot name "main" is reserved and may cause conflicts')
        })

        it('should validate max widgets metadata', () => {
            const slot = new HtmlSlot(mockElement, 'header', { maxWidgets: 'invalid' })
            expect(slot.warnings).toContain('Max widgets should be an integer')
        })
    })

    describe('slot configuration', () => {
        it('should generate proper slot configuration', () => {
            const metadata = {
                title: 'Header Slot',
                description: 'Main header area',
                maxWidgets: 3,
                allowedTypes: ['Header', 'Navigation'],
                cssClasses: 'header-slot',
                responsive: true
            }

            const slot = new HtmlSlot(mockElement, 'header', metadata)
            const config = slot.getSlotConfiguration()

            expect(config).toEqual({
                name: 'header',
                display_name: 'Header Slot',
                description: 'Main header area',
                max_widgets: 3,
                allowed_widget_types: ['Header', 'Navigation'],
                css_classes: 'header-slot',
                responsive: true,
                selector: '[data-widget-slot="header"]',
                element: mockElement,
                isValid: true,
                errors: [],
                warnings: []
            })
        })
    })

    describe('visual management', () => {
        it('should highlight and unhighlight slots', () => {
            const slot = new HtmlSlot(mockElement, 'header')

            slot.highlight()
            expect(mockElement.classList.add).toHaveBeenCalledWith('widget-slot-highlighted')

            slot.unhighlight()
            expect(mockElement.classList.remove).toHaveBeenCalledWith('widget-slot-highlighted')
        })

        it('should set active state', () => {
            const slot = new HtmlSlot(mockElement, 'header')

            slot.setActive(true)
            expect(mockElement.classList.add).toHaveBeenCalledWith('widget-slot-active', 'widget-slot-editing')

            slot.setActive(false)
            expect(mockElement.classList.remove).toHaveBeenCalledWith('widget-slot-active', 'widget-slot-editing')
        })

        it('should update widget count and empty state', () => {
            const slot = new HtmlSlot(mockElement, 'header')

            slot.updateWidgetCount([])
            expect(mockElement.classList.add).toHaveBeenCalledWith('widget-slot-empty')

            slot.updateWidgetCount([{ id: 1 }, { id: 2 }])
            expect(slot.widgets).toHaveLength(2)
            expect(mockElement.classList.remove).toHaveBeenCalledWith('widget-slot-empty')
        })
    })
})

describe('HtmlSlotDetector', () => {
    let container

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        document.body.removeChild(container)
    })

    describe('slot detection', () => {
        it('should detect basic slots', () => {
            container.innerHTML = `
                <div data-widget-slot="header">Header Slot</div>
                <div data-widget-slot="content">Content Slot</div>
                <div data-widget-slot="sidebar">Sidebar Slot</div>
            `

            const detector = new HtmlSlotDetector(container)
            const slots = detector.getAllSlots()

            expect(slots).toHaveLength(3)
            expect(slots.map(s => s.name)).toEqual(['header', 'content', 'sidebar'])
        })

        it('should extract metadata from attributes', () => {
            container.innerHTML = `
                <div 
                    data-widget-slot="header"
                    data-slot-title="Main Header"
                    data-slot-description="Site header area"
                    data-slot-max-widgets="2"
                    data-slot-allowed-types="Header,Navigation"
                    data-slot-css-classes="header-area"
                    data-slot-responsive="true"
                >
                    Header Content
                </div>
            `

            const detector = new HtmlSlotDetector(container)
            const slot = detector.getSlot('header')

            expect(slot.metadata).toEqual({
                title: 'Main Header',
                description: 'Site header area',
                maxWidgets: 2,
                allowedTypes: ['Header', 'Navigation'],
                cssClasses: 'header-area',
                responsive: true
            })
        })

        it('should handle slots without names', () => {
            container.innerHTML = `
                <div data-widget-slot="">Empty name</div>
                <div data-widget-slot>No value</div>
            `

            const detector = new HtmlSlotDetector(container)

            expect(detector.errors).toContain('Element 0 has slot attribute but no slot name')
            expect(detector.errors).toContain('Element 1 has slot attribute but no slot name')
        })

        it('should handle duplicate slot names', () => {
            container.innerHTML = `
                <div data-widget-slot="header">First Header</div>
                <div data-widget-slot="header">Duplicate Header</div>
            `

            const detector = new HtmlSlotDetector(container)

            expect(detector.warnings).toContain('Duplicate slot name "header" found - using first occurrence')
            expect(detector.getAllSlots()).toHaveLength(1)
        })

        it('should add CSS classes when enabled', () => {
            container.innerHTML = `<div data-widget-slot="header">Header</div>`

            const detector = new HtmlSlotDetector(container, { addCssClasses: true })
            const slotElement = container.querySelector('[data-widget-slot="header"]')

            expect(slotElement.classList.contains('widget-slot-container')).toBe(true)
        })
    })

    describe('slot management', () => {
        it('should get slot elements mapping', () => {
            container.innerHTML = `
                <div data-widget-slot="header">Header</div>
                <div data-widget-slot="content">Content</div>
            `

            const detector = new HtmlSlotDetector(container)
            const elements = detector.getSlotElements()

            expect(Object.keys(elements)).toEqual(['header', 'content'])
            expect(elements.header.getAttribute('data-widget-slot')).toBe('header')
            expect(elements.content.getAttribute('data-widget-slot')).toBe('content')
        })

        it('should update slot widgets', () => {
            container.innerHTML = `<div data-widget-slot="header">Header</div>`

            const detector = new HtmlSlotDetector(container)
            const slot = detector.getSlot('header')

            detector.updateSlotWidgets('header', [{ id: 1 }, { id: 2 }])

            expect(slot.widgets).toHaveLength(2)
        })

        it('should highlight and unhighlight all slots', () => {
            container.innerHTML = `
                <div data-widget-slot="header">Header</div>
                <div data-widget-slot="content">Content</div>
            `

            const detector = new HtmlSlotDetector(container)

            const headerElement = container.querySelector('[data-widget-slot="header"]')
            const contentElement = container.querySelector('[data-widget-slot="content"]')

            // Mock classList methods
            headerElement.classList.add = vi.fn()
            headerElement.classList.remove = vi.fn()
            contentElement.classList.add = vi.fn()
            contentElement.classList.remove = vi.fn()

            detector.highlightAllSlots()
            expect(headerElement.classList.add).toHaveBeenCalledWith('widget-slot-highlighted')
            expect(contentElement.classList.add).toHaveBeenCalledWith('widget-slot-highlighted')

            detector.unhighlightAllSlots()
            expect(headerElement.classList.remove).toHaveBeenCalledWith('widget-slot-highlighted')
            expect(contentElement.classList.remove).toHaveBeenCalledWith('widget-slot-highlighted')
        })

        it('should set active slot', () => {
            container.innerHTML = `
                <div data-widget-slot="header">Header</div>
                <div data-widget-slot="content">Content</div>
            `

            const detector = new HtmlSlotDetector(container)

            const headerElement = container.querySelector('[data-widget-slot="header"]')
            const contentElement = container.querySelector('[data-widget-slot="content"]')

            // Mock classList methods
            headerElement.classList.add = vi.fn()
            headerElement.classList.remove = vi.fn()
            contentElement.classList.add = vi.fn()
            contentElement.classList.remove = vi.fn()

            detector.setActiveSlot('header')

            // Should deactivate all slots first
            expect(headerElement.classList.remove).toHaveBeenCalledWith('widget-slot-active', 'widget-slot-editing')
            expect(contentElement.classList.remove).toHaveBeenCalledWith('widget-slot-active', 'widget-slot-editing')

            // Then activate the specific slot
            expect(headerElement.classList.add).toHaveBeenCalledWith('widget-slot-active', 'widget-slot-editing')
        })
    })

    describe('validation', () => {
        it('should validate all slots', () => {
            container.innerHTML = `
                <div data-widget-slot="valid-slot">Valid</div>
                <div data-widget-slot="a">Too short</div>
                <div data-widget-slot="123invalid">Invalid pattern</div>
            `

            const detector = new HtmlSlotDetector(container)
            const validation = detector.validateSlots()

            expect(validation.isValid).toBe(false)
            expect(validation.slotCount).toBe(3)
            expect(validation.validSlots).toBe(1)
            expect(validation.invalidSlots).toBe(2)
            expect(validation.errors.length).toBeGreaterThan(0)
        })
    })

    describe('cleanup', () => {
        it('should cleanup resources', () => {
            container.innerHTML = `<div data-widget-slot="header">Header</div>`

            const detector = new HtmlSlotDetector(container, { observeChanges: true })

            expect(detector.observer).toBeDefined()
            expect(detector.slots.size).toBe(1)

            detector.cleanup()

            expect(detector.observer).toBeNull()
            expect(detector.slots.size).toBe(0)
        })
    })
})

describe('Utility Functions', () => {
    describe('detectSlotsFromHTML', () => {
        it('should detect slots from HTML string', () => {
            const html = `
                <div data-widget-slot="header" data-slot-title="Header">Header</div>
                <div data-widget-slot="content">Content</div>
            `

            const slots = detectSlotsFromHTML(html)

            expect(slots).toHaveLength(2)
            expect(slots[0].name).toBe('header')
            expect(slots[0].display_name).toBe('Header')
            expect(slots[1].name).toBe('content')
        })

        it('should return empty array for empty HTML', () => {
            expect(detectSlotsFromHTML('')).toEqual([])
            expect(detectSlotsFromHTML(null)).toEqual([])
            expect(detectSlotsFromHTML(undefined)).toEqual([])
        })
    })

    describe('validateSlotName', () => {
        it('should validate slot names', () => {
            expect(validateSlotName('valid-slot')).toEqual({ isValid: true, errors: [] })
            expect(validateSlotName('a')).toEqual({
                isValid: false,
                errors: ['Slot name must be at least 2 characters']
            })
            expect(validateSlotName('123invalid')).toEqual({
                isValid: false,
                errors: ['Slot name must start with a letter and contain only letters, numbers, hyphens, and underscores']
            })
            expect(validateSlotName('main')).toEqual({
                isValid: false,
                errors: ['Slot name "main" is reserved']
            })
        })
    })

    describe('getSlotConfigFromElement', () => {
        it('should extract slot configuration from element', () => {
            const element = document.createElement('div')
            element.setAttribute('data-widget-slot', 'header')
            element.setAttribute('data-slot-title', 'Main Header')
            element.setAttribute('data-slot-description', 'Site header area')

            const config = getSlotConfigFromElement(element)

            expect(config.name).toBe('header')
            expect(config.display_name).toBe('Main Header')
            expect(config.description).toBe('Site header area')
        })

        it('should return null for elements without slot attribute', () => {
            const element = document.createElement('div')
            expect(getSlotConfigFromElement(element)).toBeNull()
            expect(getSlotConfigFromElement(null)).toBeNull()
        })
    })

    describe('createSlotElement', () => {
        it('should create element with slot attributes', () => {
            const config = {
                name: 'header',
                title: 'Main Header',
                description: 'Site header area',
                maxWidgets: 2,
                cssClasses: 'header-slot'
            }

            const element = createSlotElement(config)

            expect(element.getAttribute('data-widget-slot')).toBe('header')
            expect(element.getAttribute('data-slot-title')).toBe('Main Header')
            expect(element.getAttribute('data-slot-description')).toBe('Site header area')
            expect(element.getAttribute('data-slot-max-widgets')).toBe('2')
            expect(element.getAttribute('data-slot-css-classes')).toBe('header-slot')
            expect(element.className).toBe('header-slot')
        })
    })
}) 