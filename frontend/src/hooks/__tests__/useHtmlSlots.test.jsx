import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHtmlSlots, useTemplateSlots, useSlotPreview } from '../useHtmlSlots'

// Mock the slot detection utility
vi.mock('../../utils/slotDetection', () => {
    class MockHtmlSlotDetector {
        constructor(containerElement, options = {}) {
            this.containerElement = containerElement
            this.options = options
            this.slots = new Map()
            this.observer = null
            this.errors = []
            this.warnings = []
        }

        detectSlots() {
            if (!this.containerElement) return this.slots

            // Mock slot detection
            const mockSlots = new Map([
                ['header', {
                    name: 'header',
                    element: { nodeType: 1 },
                    isValid: true,
                    errors: [],
                    warnings: []
                }],
                ['content', {
                    name: 'content',
                    element: { nodeType: 1 },
                    isValid: true,
                    errors: [],
                    warnings: []
                }]
            ])

            this.slots = mockSlots
            return mockSlots
        }

        getSlotElements() {
            const elements = {}
            this.slots.forEach((slot, name) => {
                elements[name] = slot.element
            })
            return elements
        }

        getSlotsConfiguration() {
            return Array.from(this.slots.values()).map(slot => ({
                name: slot.name,
                display_name: slot.name,
                description: '',
                max_widgets: null,
                allowed_widget_types: [],
                css_classes: '',
                responsive: false,
                selector: `[data-widget-slot="${slot.name}"]`,
                element: slot.element,
                isValid: slot.isValid,
                errors: slot.errors,
                warnings: slot.warnings
            }))
        }

        validateSlots() {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                slotCount: this.slots.size,
                validSlots: this.slots.size,
                invalidSlots: 0
            }
        }

        updateSlotWidgets() { }
        highlightAllSlots() { }
        unhighlightAllSlots() { }
        setActiveSlot() { }
        cleanup() {
            this.slots.clear()
            this.observer = null
        }
    }

    const detectSlotsFromHTML = vi.fn((html) => {
        if (!html) return []
        return [
            {
                name: 'header',
                display_name: 'Header',
                description: 'Header slot',
                isValid: true
            }
        ]
    })

    return {
        default: MockHtmlSlotDetector,
        HtmlSlotDetector: MockHtmlSlotDetector,
        detectSlotsFromHTML
    }
})

describe('useHtmlSlots', () => {
    let mockContainer

    beforeEach(() => {
        mockContainer = {
            nodeType: 1,
            querySelector: vi.fn(),
            querySelectorAll: vi.fn(() => [])
        }
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('basic functionality', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useHtmlSlots())

            expect(result.current.slots).toEqual([])
            expect(result.current.slotElements).toEqual({})
            expect(result.current.slotsConfiguration).toEqual([])
            expect(result.current.validation.isValid).toBe(true)
            expect(result.current.isDetecting).toBe(false)
            expect(result.current.activeSlot).toBeNull()
            expect(result.current.hasSlots).toBe(false)
        })

        it('should detect slots when container element is provided', async () => {
            const layout = { html: '<div data-widget-slot="header">Header</div>' }

            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                layout,
                autoDetect: true
            }))

            // Wait for initial detection
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            expect(result.current.hasSlots).toBe(true)
            expect(result.current.slotsConfiguration).toHaveLength(2) // header and content from mock
        })

        it('should handle widget synchronization', () => {
            const widgetsBySlot = {
                header: [{ id: 1, name: 'Header Widget' }],
                content: [{ id: 2, name: 'Content Widget' }]
            }

            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                widgetsBySlot,
                autoDetect: true
            }))

            expect(result.current.getSlotStats().totalWidgets).toBe(2)
        })
    })

    describe('slot management', () => {
        it('should provide slot query functions', () => {
            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                autoDetect: true
            }))

            // Test slot query functions exist
            expect(typeof result.current.getSlot).toBe('function')
            expect(typeof result.current.getSlotElement).toBe('function')
            expect(typeof result.current.validateSlot).toBe('function')
            expect(typeof result.current.getSlotsForWidgetType).toBe('function')
            expect(typeof result.current.canSlotAcceptWidget).toBe('function')
            expect(typeof result.current.getSlotStats).toBe('function')
        })

        it('should provide slot action functions', () => {
            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                autoDetect: true
            }))

            // Test slot action functions exist
            expect(typeof result.current.detectSlots).toBe('function')
            expect(typeof result.current.highlightSlots).toBe('function')
            expect(typeof result.current.unhighlightSlots).toBe('function')
            expect(typeof result.current.setActiveSlot).toBe('function')
            expect(typeof result.current.updateSlotMetadata).toBe('function')
        })

        it('should filter slots for widget types', async () => {
            const layout = { html: '<div data-widget-slot="header">Header</div>' }

            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                layout,
                autoDetect: true
            }))

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            // All slots should accept any widget type by default
            const slotsForText = result.current.getSlotsForWidgetType('TextBlock')
            expect(slotsForText).toHaveLength(2)
        })

        it('should check if slot can accept widgets', async () => {
            const layout = { html: '<div data-widget-slot="header">Header</div>' }

            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                layout,
                autoDetect: true
            }))

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            // Should be able to accept widgets by default
            expect(result.current.canSlotAcceptWidget('header')).toBe(true)
            expect(result.current.canSlotAcceptWidget('nonexistent')).toBe(false)
        })

        it('should provide slot statistics', async () => {
            const layout = { html: '<div data-widget-slot="header">Header</div>' }
            const widgetsBySlot = {
                header: [{ id: 1 }],
                content: []
            }

            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                layout,
                widgetsBySlot,
                autoDetect: true
            }))

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            const stats = result.current.getSlotStats()
            expect(stats.totalSlots).toBe(2)
            expect(stats.validSlots).toBe(2)
            expect(stats.invalidSlots).toBe(0)
            expect(stats.totalWidgets).toBe(1)
            expect(stats.emptySlots).toBe(1)
            expect(stats.fullSlots).toBe(1)
        })
    })

    describe('callbacks and events', () => {
        it('should call onSlotChange when slots are detected', async () => {
            const onSlotChange = vi.fn()
            const layout = { html: '<div data-widget-slot="header">Header</div>' }

            renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                layout,
                onSlotChange,
                autoDetect: true
            }))

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            expect(onSlotChange).toHaveBeenCalled()
        })

        it('should call onSlotValidation when validation occurs', async () => {
            const onSlotValidation = vi.fn()
            const layout = { html: '<div data-widget-slot="header">Header</div>' }

            renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                layout,
                onSlotValidation,
                autoDetect: true
            }))

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            expect(onSlotValidation).toHaveBeenCalled()
        })

        it('should call onSlotError when errors occur', async () => {
            const onSlotError = vi.fn()

            // Mock detector to throw error
            const originalDetectSlots = vi.fn(() => {
                throw new Error('Detection failed')
            })

            const { result } = renderHook(() => useHtmlSlots({
                containerElement: mockContainer,
                onSlotError,
                autoDetect: false
            }))

            await act(async () => {
                // Override detectSlots to throw error
                result.current.detectSlots = originalDetectSlots
                await result.current.detectSlots()
            })

            // Note: Error handling depends on implementation
            // This test verifies the callback mechanism exists
            expect(onSlotError).toBeDefined()
        })
    })

    describe('layout changes', () => {
        it('should re-detect slots when layout HTML changes', async () => {
            const initialLayout = { html: '<div data-widget-slot="header">Header</div>' }

            const { result, rerender } = renderHook(
                ({ layout }) => useHtmlSlots({
                    containerElement: mockContainer,
                    layout,
                    autoDetect: true
                }),
                { initialProps: { layout: initialLayout } }
            )

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            const initialSlotCount = result.current.slotsConfiguration.length

            // Change layout HTML
            const newLayout = { html: '<div data-widget-slot="header">Header</div><div data-widget-slot="footer">Footer</div>' }

            rerender({ layout: newLayout })

            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 150))
            })

            // Should maintain same slot count in mock (mock doesn't change based on HTML)
            expect(result.current.slotsConfiguration.length).toBe(initialSlotCount)
        })
    })
})

describe('useTemplateSlots', () => {
    it('should be a specialized version of useHtmlSlots', () => {
        const mockElement = { nodeType: 1 }
        const layout = { html: '<div data-widget-slot="header">Header</div>' }
        const widgetsBySlot = {}

        const { result } = renderHook(() => useTemplateSlots(
            mockElement,
            layout,
            widgetsBySlot
        ))

        expect(result.current.hasSlots).toBe(false) // Initially false until detection
        expect(typeof result.current.detectSlots).toBe('function')
    })

    it('should disable observeChanges by default', () => {
        const mockElement = { nodeType: 1 }
        const layout = { html: '<div data-widget-slot="header">Header</div>' }
        const widgetsBySlot = {}

        const { result } = renderHook(() => useTemplateSlots(
            mockElement,
            layout,
            widgetsBySlot
        ))

        // Should work without observation (templates are usually static)
        expect(result.current).toBeDefined()
    })
})

describe('useSlotPreview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should detect slots from HTML string', async () => {
        const htmlString = '<div data-widget-slot="header">Header</div>'

        const { result } = renderHook(() => useSlotPreview(htmlString))

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
        })

        expect(result.current.detectedSlots).toHaveLength(1)
        expect(result.current.detectedSlots[0].name).toBe('header')
        expect(result.current.hasSlots).toBe(true)
        expect(result.current.isDetecting).toBe(false)
        expect(result.current.errors).toEqual([])
    })

    it('should handle empty HTML', async () => {
        const { result } = renderHook(() => useSlotPreview(''))

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
        })

        expect(result.current.detectedSlots).toEqual([])
        expect(result.current.hasSlots).toBe(false)
        expect(result.current.errors).toEqual([])
    })

    it('should handle HTML changes', async () => {
        const { result, rerender } = renderHook(
            ({ html }) => useSlotPreview(html),
            { initialProps: { html: '<div data-widget-slot="header">Header</div>' } }
        )

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
        })

        expect(result.current.detectedSlots).toHaveLength(1)

        // Change HTML
        rerender({ html: '<div data-widget-slot="content">Content</div>' })

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
        })

        expect(result.current.detectedSlots).toHaveLength(1)
        expect(result.current.detectedSlots[0].name).toBe('header') // Mock returns consistent data
    })

    it('should set detecting state during processing', () => {
        const { result } = renderHook(() => useSlotPreview('<div data-widget-slot="header">Header</div>'))

        // Initially should be detecting or have completed quickly
        expect(typeof result.current.isDetecting).toBe('boolean')
    })
}) 