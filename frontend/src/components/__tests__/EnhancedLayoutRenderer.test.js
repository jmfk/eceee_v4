/**
 * Tests for Enhanced LayoutRenderer with Icon Menu functionality
 * Tests the vanilla JavaScript UI enhancements without React dependencies
 */

import { vi } from 'vitest'
import LayoutRenderer from '../LayoutRenderer.js'

describe('Enhanced LayoutRenderer - Icon Menu Tests', () => {
    let renderer
    let containerRef
    let mockLayout

    beforeEach(() => {
        // Create container element
        containerRef = { current: document.createElement('div') }
        document.body.appendChild(containerRef.current)

        // Create renderer instance
        renderer = new LayoutRenderer()

        // Mock layout with slots
        mockLayout = {
            structure: {
                type: 'element',
                tag: 'div',
                classes: 'layout-container',
                children: [
                    {
                        type: 'slot',
                        tag: 'div',
                        classes: 'slot-container',
                        slot: {
                            name: 'header-slot',
                            title: 'Header Slot',
                            description: 'Main header area'
                        }
                    },
                    {
                        type: 'slot',
                        tag: 'div',
                        classes: 'slot-container',
                        slot: {
                            name: 'content-slot',
                            title: 'Content Slot',
                            description: 'Main content area'
                        }
                    }
                ]
            }
        }
    })

    afterEach(() => {
        if (renderer) {
            renderer.destroy()
        }
        if (containerRef.current && containerRef.current.parentNode) {
            containerRef.current.parentNode.removeChild(containerRef.current)
        }
    })

    describe('UI Configuration', () => {
        test('should set UI config', () => {
            const config = {
                showAddWidget: true,
                showEditSlot: true,
                showSlotVisibility: true
            }

            renderer.setUIConfig(config)

            expect(renderer.uiConfig.showAddWidget).toBe(true)
            expect(renderer.uiConfig.showEditSlot).toBe(true)
            expect(renderer.uiConfig.showSlotVisibility).toBe(true)
        })

        test('should set UI callbacks', () => {
            const callbacks = {
                onAddWidget: vi.fn(),
                onEditSlot: vi.fn(),
                onToggleVisibility: vi.fn()
            }

            renderer.setUICallbacks(callbacks)

            expect(renderer.uiCallbacks.get('onAddWidget')).toBe(callbacks.onAddWidget)
            expect(renderer.uiCallbacks.get('onEditSlot')).toBe(callbacks.onEditSlot)
            expect(renderer.uiCallbacks.get('onToggleVisibility')).toBe(callbacks.onToggleVisibility)
        })
    })

    describe('Icon Menu Creation', () => {
        beforeEach(() => {
            renderer.render(mockLayout, containerRef)
        })

        test('should add icon menu to specific slot', () => {
            renderer.addSlotIconMenu('header-slot', {
                showAddWidget: true,
                showEditSlot: true
            })

            const menuElement = renderer.slotUIElements.get('header-slot')
            expect(menuElement).toBeTruthy()
            expect(menuElement.classList.contains('slot-icon-menu')).toBe(true)
            expect(menuElement.getAttribute('data-slot-menu')).toBe('header-slot')
        })

        test('should warn when adding menu to nonexistent slot', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            renderer.addSlotIconMenu('nonexistent-slot')

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'LayoutRenderer: Slot "nonexistent-slot" not found for icon menu'
            )

            consoleWarnSpy.mockRestore()
        })

        test('should add icon menus to all slots', () => {
            renderer.addIconMenusToAllSlots({
                showAddWidget: true,
                showEditSlot: true
            })

            const headerMenu = renderer.slotUIElements.get('header-slot')
            const contentMenu = renderer.slotUIElements.get('content-slot')

            expect(headerMenu).toBeTruthy()
            expect(contentMenu).toBeTruthy()
            expect(renderer.slotUIElements.size).toBe(2)
        })
    })

    describe('Menu Functionality', () => {
        beforeEach(() => {
            renderer.render(mockLayout, containerRef)
            renderer.setUIConfig({
                showAddWidget: true,
                showEditSlot: true,
                showSlotVisibility: true
            })
        })

        test('should create menu button with proper attributes', () => {
            renderer.addSlotIconMenu('header-slot')

            const menuElement = renderer.slotUIElements.get('header-slot')
            const menuButton = menuElement.querySelector('button')

            expect(menuButton).toBeTruthy()
            expect(menuButton.textContent).toBe('⋯')
            expect(menuButton.title).toBe('Slot: header-slot')
        })

        test('should create menu dropdown with items', () => {
            renderer.addSlotIconMenu('header-slot', {
                showAddWidget: true,
                showEditSlot: true,
                showSlotVisibility: true
            })

            const menuElement = renderer.slotUIElements.get('header-slot')
            const dropdown = menuElement.querySelector('[data-menu-dropdown="header-slot"]')

            expect(dropdown).toBeTruthy()
            expect(dropdown.classList.contains('hidden')).toBe(true)

            const menuItems = dropdown.querySelectorAll('button')
            expect(menuItems.length).toBeGreaterThan(0)
        })

        test('should toggle menu visibility on button click', () => {
            renderer.addSlotIconMenu('header-slot')

            const menuElement = renderer.slotUIElements.get('header-slot')
            const menuButton = menuElement.querySelector('button')
            const dropdown = menuElement.querySelector('[data-menu-dropdown="header-slot"]')

            // Initially hidden
            expect(dropdown.classList.contains('hidden')).toBe(true)

            // Click to show
            menuButton.click()
            expect(dropdown.classList.contains('hidden')).toBe(false)

            // Click again to hide (closes all menus)
            menuButton.click()
            expect(dropdown.classList.contains('hidden')).toBe(true)
        })
    })

    describe('Slot Visibility', () => {
        beforeEach(() => {
            renderer.render(mockLayout, containerRef)
        })

        test('should check slot visibility correctly', () => {
            expect(renderer.isSlotVisible('header-slot')).toBe(true)

            const slotElement = renderer.slotContainers.get('header-slot')
            slotElement.style.display = 'none'

            expect(renderer.isSlotVisible('header-slot')).toBe(false)
        })

        test('should toggle slot visibility', () => {
            const slotElement = renderer.slotContainers.get('header-slot')

            // Initially visible
            expect(renderer.isSlotVisible('header-slot')).toBe(true)

            // Toggle to hidden
            renderer.toggleSlotVisibility('header-slot')
            expect(slotElement.style.display).toBe('none')
            expect(slotElement.style.opacity).toBe('0.5')

            // Toggle back to visible
            renderer.toggleSlotVisibility('header-slot')
            expect(slotElement.style.display).toBe('block')
            expect(slotElement.style.opacity).toBe('1')
        })
    })

    describe('Callback Execution', () => {
        beforeEach(() => {
            renderer.render(mockLayout, containerRef)
        })

        test('should execute callbacks correctly', () => {
            const mockCallback = vi.fn()
            renderer.setUICallbacks({ onAddWidget: mockCallback })

            renderer.executeCallback('onAddWidget', 'header-slot', 'extra-arg')

            expect(mockCallback).toHaveBeenCalledWith('header-slot', 'extra-arg')
        })

        test('should handle callback errors gracefully', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
            const errorCallback = vi.fn(() => { throw new Error('Test error') })

            renderer.setUICallbacks({ onEditSlot: errorCallback })

            renderer.executeCallback('onEditSlot', 'header-slot')

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error executing callback onEditSlot'),
                expect.any(Error)
            )

            consoleErrorSpy.mockRestore()
        })

        test('should handle missing callbacks gracefully', () => {
            // Should not throw error when callback doesn't exist
            expect(() => {
                renderer.executeCallback('nonexistentCallback', 'header-slot')
            }).not.toThrow()
        })
    })

    describe('UI Cleanup', () => {
        beforeEach(() => {
            renderer.render(mockLayout, containerRef)
            renderer.addIconMenusToAllSlots({ showAddWidget: true })
        })

        test('should remove UI from specific slot', () => {
            expect(renderer.slotUIElements.get('header-slot')).toBeTruthy()

            renderer.removeSlotUI('header-slot')

            expect(renderer.slotUIElements.get('header-slot')).toBeUndefined()
        })

        test('should remove all slot UI', () => {
            expect(renderer.slotUIElements.size).toBe(2)

            renderer.removeAllSlotUI()

            expect(renderer.slotUIElements.size).toBe(0)
        })

        test('should clean up UI elements on destroy', () => {
            expect(renderer.slotUIElements.size).toBe(2)

            renderer.destroy()

            expect(renderer.slotUIElements.size).toBe(0)
            expect(renderer.uiCallbacks.size).toBe(0)
            expect(renderer.isDestroyed).toBe(true)
        })
    })

    describe('Menu Item Generation', () => {
        beforeEach(() => {
            renderer.render(mockLayout, containerRef)
            renderer.setUIConfig({
                showAddWidget: true,
                showEditSlot: true,
                showSlotVisibility: true
            })
        })

        test('should generate correct menu items based on config', () => {
            const items = renderer.getMenuItems('header-slot', {
                showClearSlot: true,
                showSlotInfo: true
            })

            const labels = items.map(item => item.label).filter(Boolean)

            expect(labels).toContain('Add Widget')
            expect(labels).toContain('Edit Slot')
            expect(labels).toContain('Hide Slot') // Visibility toggle
            expect(labels).toContain('Clear Slot')
            expect(labels).toContain('Slot Info')
        })

        test('should create menu item elements correctly', () => {
            const menuItem = renderer.createMenuItem('🧪', 'Test Item', vi.fn(), 'test-class')

            expect(menuItem.tagName).toBe('BUTTON')
            expect(menuItem.classList.contains('test-class')).toBe(true)
            expect(menuItem.textContent).toContain('Test Item')
            expect(menuItem.innerHTML).toContain('🧪')
        })
    })

    describe('Icon Button Creation', () => {
        test('should create icon button with proper styling', () => {
            const clickHandler = vi.fn()
            const button = renderer.createIconButton('⭐', 'test-class', clickHandler)

            expect(button.tagName).toBe('BUTTON')
            expect(button.innerHTML).toBe('⭐')
            expect(button.classList.contains('test-class')).toBe(true)
            expect(button.classList.contains('w-6')).toBe(true)
            expect(button.classList.contains('h-6')).toBe(true)

            button.click()
            expect(clickHandler).toHaveBeenCalled()
        })
    })
}) 