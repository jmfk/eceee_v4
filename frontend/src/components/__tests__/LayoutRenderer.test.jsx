/**
 * Unit tests for LayoutRenderer error handling and validation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LayoutRenderer from '../LayoutRenderer';

describe('LayoutRenderer Security and Error Handling', () => {
    let renderer;
    let mockContainer;
    let mockTargetRef;

    beforeEach(() => {
        renderer = new LayoutRenderer();

        // Create mock DOM container
        mockContainer = document.createElement('div');
        document.body.appendChild(mockContainer);

        mockTargetRef = {
            current: mockContainer
        };

        // Clear console spies
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (renderer) {
            renderer.destroy();
        }

        if (mockContainer && mockContainer.parentNode) {
            mockContainer.parentNode.removeChild(mockContainer);
        }
    });

    describe('Layout Validation', () => {
        it('should validate valid layout structure', () => {
            const validLayout = {
                type: 'element',
                tag: 'div',
                children: [
                    { type: 'text', content: 'Hello World' },
                    { type: 'slot', slot: { name: 'content' } }
                ]
            };

            expect(renderer.validateLayout(validLayout)).toBe(true);
        });

        it('should reject invalid layout structure', () => {
            const invalidLayouts = [
                null,
                undefined,
                'string',
                123,
                { type: 'invalid_type' },
                { type: 'element', children: 'not_array' }
            ];

            invalidLayouts.forEach((layout, index) => {
                const result = renderer.validateLayout(layout);
                expect(result).toBe(false);
            });
        });

        it('should validate nested layout structure', () => {
            const nestedLayout = {
                type: 'element',
                tag: 'div',
                children: [
                    {
                        type: 'element',
                        tag: 'section',
                        children: [
                            { type: 'text', content: 'Nested content' }
                        ]
                    }
                ]
            };

            expect(renderer.validateLayout(nestedLayout)).toBe(true);
        });

        it('should reject layout with invalid nested children', () => {
            const invalidNestedLayout = {
                type: 'element',
                tag: 'div',
                children: [
                    { type: 'invalid_type' },
                    { type: 'text', content: 'Valid content' }
                ]
            };

            expect(renderer.validateLayout(invalidNestedLayout)).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle render errors gracefully', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const invalidLayout = null;
            renderer.render(invalidLayout, mockTargetRef);

            // Should render error message instead of crashing
            expect(mockContainer.querySelector('.error-container')).toBeTruthy();
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should handle widget rendering errors', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Set a widget renderer that throws an error
            renderer.setWidgetRenderer(() => {
                throw new Error('Widget rendering failed');
            });

            const layoutWithSlot = {
                type: 'slot',
                tag: 'div',
                slot: {
                    name: 'test-slot',
                    defaultWidgets: [{ type: 'test', config: {} }]
                }
            };

            renderer.render(layoutWithSlot, mockTargetRef);

            // Should handle widget error gracefully
            expect(mockContainer.querySelector('.widget-error')).toBeTruthy();
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should prevent operation on destroyed renderer', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            renderer.destroy();

            const layout = { type: 'element', tag: 'div' };
            renderer.render(layout, mockTargetRef);

            expect(consoleWarnSpy).toHaveBeenCalledWith('LayoutRenderer: Cannot render on destroyed instance');

            consoleWarnSpy.mockRestore();
        });

        it('should handle missing target ref gracefully', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const invalidRef = { current: null };
            const layout = { type: 'element', tag: 'div' };

            renderer.render(layout, invalidRef);

            expect(consoleWarnSpy).toHaveBeenCalledWith('LayoutRenderer: Target ref is not available');

            consoleWarnSpy.mockRestore();
        });
    });

    describe('Input Validation', () => {
        it('should validate tag names', () => {
            const layouts = [
                { type: 'element', tag: 'script' }, // Valid but potentially dangerous
                { type: 'element', tag: 'div123' }, // Valid
                { type: 'element', tag: '123div' }, // Invalid (starts with number)
                { type: 'element', tag: 'div<script>' }, // Invalid (contains special chars)
                { type: 'element', tag: '' } // Invalid (empty)
            ];

            // First two should work, others should be handled safely
            renderer.render(layouts[0], mockTargetRef);
            expect(mockContainer.children.length).toBe(1);

            mockContainer.innerHTML = '';
            renderer.render(layouts[1], mockTargetRef);
            expect(mockContainer.children.length).toBe(1);

            // Invalid tag names should result in error elements
            layouts.slice(2).forEach((layout, index) => {
                mockContainer.innerHTML = '';
                renderer.render(layout, mockTargetRef);

                // Should render error container or node-error
                const hasError = mockContainer.querySelector('.error-container') ||
                    mockContainer.querySelector('.node-error');
                expect(hasError).toBeTruthy();
            });
        });

        it('should validate and sanitize attributes', () => {
            const layoutWithAttributes = {
                type: 'element',
                tag: 'div',
                attributes: {
                    'valid-attr': 'safe value',
                    'data-test': 'test',
                    'on<click>': 'dangerous()', // Invalid attribute name
                    'onclick': 'alert(1)' // Valid name but dangerous value (should be escaped)
                }
            };

            renderer.render(layoutWithAttributes, mockTargetRef);

            const element = mockContainer.firstChild;
            expect(element.getAttribute('valid-attr')).toBe('safe value');
            expect(element.getAttribute('data-test')).toBe('test');
            expect(element.getAttribute('on<click>')).toBeNull(); // Should be filtered out
            expect(element.getAttribute('onclick')).toBe('alert(1)'); // Should be preserved but escaped
        });

        it('should escape HTML content in text nodes', () => {
            const layoutWithHtml = {
                type: 'element',
                tag: 'div',
                children: [
                    { type: 'text', content: '<script>alert("xss")</script>Safe text' }
                ]
            };

            renderer.render(layoutWithHtml, mockTargetRef);

            const textContent = mockContainer.textContent;
            expect(textContent).toContain('<script>');
            expect(textContent).toContain('Safe text');
            // HTML should be escaped, not executed
            expect(mockContainer.querySelector('script')).toBeNull();
        });
    });

    describe('Memory Management', () => {
        it('should track event listeners for cleanup', () => {
            const mockElement = document.createElement('div');
            const mockHandler = vi.fn();

            renderer.addTrackedEventListener(mockElement, 'click', mockHandler);

            // Event listener should be tracked
            expect(renderer.eventListeners.size).toBe(1);

            // Cleanup should remove listener
            renderer.destroy();
            expect(renderer.eventListeners.size).toBe(0);
        });

        it('should clean up DOM efficiently', () => {
            // Add multiple elements to container
            for (let i = 0; i < 10; i++) {
                const child = document.createElement('div');
                child.textContent = `Child ${i}`;
                mockContainer.appendChild(child);
            }

            expect(mockContainer.children.length).toBe(10);

            // Cleanup should remove all children efficiently
            renderer.cleanup(mockContainer);
            expect(mockContainer.children.length).toBe(0);
        });

        it('should handle cleanup errors gracefully', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Create a mock container that throws errors on removeChild
            const problematicContainer = {
                firstChild: document.createElement('div'),
                removeChild: () => {
                    throw new Error('Cannot remove child');
                }
            };

            // Should fallback to innerHTML clearing
            renderer.cleanup(problematicContainer);

            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Widget Validation', () => {
        it('should validate widget objects', () => {
            const validWidget = { type: 'text', config: { content: 'Hello' } };
            const invalidWidgets = [
                null,
                undefined,
                'string',
                {},
                { config: { content: 'Missing type' } },
                { type: 123 }
            ];

            // Valid widget should render
            const result = renderer.renderWidget(validWidget);
            expect(result).toBeTruthy();
            expect(result.className).toContain('widget-placeholder');

            // Invalid widgets should return error elements
            invalidWidgets.forEach(widget => {
                const result = renderer.renderWidget(widget);
                expect(result).toBeTruthy();
                expect(result.className).toContain('widget-error');
            });
        });

        it('should handle widget renderer errors', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Set renderer that returns invalid result
            renderer.setWidgetRenderer(() => 'not a dom node');

            const widget = { type: 'test' };
            const result = renderer.renderWidget(widget);

            expect(result.className).toContain('widget-error');
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should validate widget renderer function', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            // Invalid renderer types should be rejected
            renderer.setWidgetRenderer('not a function');
            renderer.setWidgetRenderer(123);
            renderer.setWidgetRenderer({});

            expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
            consoleWarnSpy.mockRestore();
        });
    });

    describe('Slot Management', () => {
        it('should handle slot updates with validation', () => {
            const layoutWithSlot = {
                type: 'slot',
                tag: 'div',
                slot: { name: 'test-slot' }
            };

            renderer.render(layoutWithSlot, mockTargetRef);

            // Valid widget array
            renderer.updateSlot('test-slot', [{ type: 'text', config: {} }]);
            expect(mockContainer.children.length).toBe(1);

            // Invalid widget array should be handled
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            renderer.updateSlot('test-slot', 'not an array');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('should handle missing slots gracefully', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            renderer.updateSlot('nonexistent-slot', []);

            expect(consoleWarnSpy).toHaveBeenCalledWith('LayoutRenderer: Slot "nonexistent-slot" not found');
            consoleWarnSpy.mockRestore();
        });

        it('should prevent slot operations on destroyed renderer', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            renderer.destroy();
            renderer.updateSlot('test-slot', []);

            expect(consoleWarnSpy).toHaveBeenCalledWith('LayoutRenderer: Cannot update slot on destroyed instance');
            consoleWarnSpy.mockRestore();
        });
    });

    describe('XSS Prevention', () => {
        it('should escape HTML in error messages', () => {
            const maliciousMessage = '<script>alert("xss")</script>Dangerous';
            const errorElement = renderer.createErrorElement(maliciousMessage);

            expect(errorElement.textContent).toContain('<script>');
            expect(errorElement.querySelector('script')).toBeNull();
        });

        it('should escape HTML in widget content', () => {
            const maliciousWidget = {
                type: '<script>alert("xss")</script>text',
                config: {
                    content: '<img src=x onerror=alert("xss2")>',
                    title: '</div><script>alert("xss3")</script>'
                }
            };

            const result = renderer.renderWidget(maliciousWidget);

            // HTML should be escaped in all content
            expect(result.innerHTML).not.toContain('<script>');
            expect(result.innerHTML).not.toContain('<img');
            expect(result.innerHTML).toContain('&lt;script&gt;');
            expect(result.querySelector('script')).toBeNull();
            expect(result.querySelector('img')).toBeNull();
            // Content should be safely escaped
            expect(result.innerHTML).toContain('&lt;');
        });

        it('should escape HTML in slot placeholders', () => {
            const maliciousSlot = {
                type: 'slot',
                tag: 'div',
                slot: {
                    name: '<script>alert("xss")</script>',
                    title: '<img src=x onerror=alert("xss2")>',
                    description: '</div><script>evil()</script>'
                }
            };

            renderer.render(maliciousSlot, mockTargetRef);

            const placeholder = mockContainer.querySelector('.slot-placeholder');
            expect(placeholder).toBeTruthy();
            expect(placeholder.innerHTML).not.toContain('<script>');
            expect(placeholder.innerHTML).not.toContain('<img');
            expect(placeholder.innerHTML).toContain('&lt;script&gt;');
            // All dangerous content should be properly escaped
            expect(placeholder.innerHTML).toContain('&lt;');
        });
    });

    describe('Performance', () => {
        it('should efficiently handle large number of children', () => {
            const start = performance.now();

            const largeLayout = {
                type: 'element',
                tag: 'div',
                children: Array.from({ length: 1000 }, (_, i) => ({
                    type: 'text',
                    content: `Child ${i}`
                }))
            };

            renderer.render(largeLayout, mockTargetRef);

            const end = performance.now();

            // Should complete in reasonable time (less than 100ms)
            expect(end - start).toBeLessThan(100);
            expect(mockContainer.children.length).toBe(1);
            expect(mockContainer.textContent).toContain('Child 0');
            expect(mockContainer.textContent).toContain('Child 999');
        });

        it('should handle rapid re-renders without memory leaks', () => {
            const layout = {
                type: 'element',
                tag: 'div',
                children: [{ type: 'text', content: 'Test' }]
            };

            // Render multiple times rapidly
            for (let i = 0; i < 100; i++) {
                renderer.render(layout, mockTargetRef);
            }

            // Should maintain clean state
            expect(mockContainer.children.length).toBe(1);
            expect(renderer.slotContainers.size).toBe(0);
            expect(renderer.eventListeners.size).toBe(0);
        });
    });
});

describe('LayoutRenderer Integration', () => {
    let renderer;
    let mockContainer;
    let mockTargetRef;

    beforeEach(() => {
        renderer = new LayoutRenderer();
        mockContainer = document.createElement('div');
        document.body.appendChild(mockContainer);
        mockTargetRef = { current: mockContainer };
    });

    afterEach(() => {
        renderer.destroy();
        if (mockContainer.parentNode) {
            mockContainer.parentNode.removeChild(mockContainer);
        }
    });

    it('should handle complex nested layouts with slots and widgets', () => {
        const complexLayout = {
            type: 'element',
            tag: 'main',
            classes: 'container',
            children: [
                {
                    type: 'element',
                    tag: 'header',
                    children: [
                        {
                            type: 'slot',
                            tag: 'div',
                            slot: {
                                name: 'header-content',
                                title: 'Header Slot',
                                defaultWidgets: [
                                    { type: 'navigation', config: { items: ['Home', 'About'] } }
                                ]
                            }
                        }
                    ]
                },
                {
                    type: 'element',
                    tag: 'section',
                    children: [
                        { type: 'text', content: 'Welcome to our site!' },
                        {
                            type: 'slot',
                            tag: 'div',
                            slot: { name: 'main-content' }
                        }
                    ]
                }
            ]
        };

        renderer.render(complexLayout, mockTargetRef);

        // Verify structure
        expect(mockContainer.querySelector('main')).toBeTruthy();
        expect(mockContainer.querySelector('header')).toBeTruthy();
        expect(mockContainer.querySelector('section')).toBeTruthy();

        // Verify slots
        expect(renderer.getSlotNames()).toContain('header-content');
        expect(renderer.getSlotNames()).toContain('main-content');

        // Verify text content
        expect(mockContainer.textContent).toContain('Welcome to our site!');

        // Verify default widget rendered
        expect(mockContainer.querySelector('[data-slot-name="header-content"]')).toBeTruthy();
    });
}); 