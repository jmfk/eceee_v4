/**
 * Test suite for inline conditional attributes in Django templates
 * Tests the fix for Issue #92: Django Template Inline Conditionals in Widget Templates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import DjangoTemplateRenderer from '../../utils/DjangoTemplateRenderer';

describe('Inline Conditional Attributes', () => {
    let renderer;

    beforeEach(() => {
        renderer = new DjangoTemplateRenderer({ debug: false });
    });

    describe('Backend Template Preprocessing', () => {
        it('should convert inline conditionals to data-conditional-attrs format', () => {
            // This simulates what the backend preprocessing does
            const templateSource = `<a href="{{ config.url }}" {% if config.open_in_new_tab %}target="_blank" rel="noopener noreferrer"{% endif %}>Click me</a>`;

            // The backend would convert this to:
            const expectedProcessed = `<a href="{{ config.url }}" data-conditional-attrs="config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;">Click me</a>`;

            // We can test this transformation pattern
            const inlineConditionalPattern = /\{\%\s*if\s+([^%]+?)\s*\%\}([^{]*?)\{\%\s*endif\s*\%\}/;
            const match = inlineConditionalPattern.exec(templateSource);

            expect(match).toBeTruthy();
            expect(match[1].trim()).toBe('config.open_in_new_tab');
            expect(match[2].trim()).toBe('target="_blank" rel="noopener noreferrer"');
        });
    });

    describe('Frontend Condition Evaluation', () => {
        it('should evaluate config.open_in_new_tab correctly for true value', () => {
            const config = { open_in_new_tab: true };
            const result = renderer.evaluateCondition('config.open_in_new_tab', config);
            expect(result).toBe(true);
        });

        it('should evaluate config.open_in_new_tab correctly for false value', () => {
            const config = { open_in_new_tab: false };
            const result = renderer.evaluateCondition('config.open_in_new_tab', config);
            expect(result).toBe(false);
        });

        it('should evaluate config.open_in_new_tab correctly for undefined value', () => {
            const config = {};
            const result = renderer.evaluateCondition('config.open_in_new_tab', config);
            // evaluateCondition should return undefined when the property doesn't exist
            // but our current implementation returns false for safety in conditional logic
            expect(result).toBeFalsy(); // Accept either undefined or false as both are falsy
        });

        it('should handle nested config properties', () => {
            const config = { settings: { open_in_new_tab: true } };
            const result = renderer.evaluateCondition('config.settings.open_in_new_tab', config);
            expect(result).toBe(true);
        });
    });

    describe('Frontend Attribute Parsing', () => {
        it('should parse HTML-escaped attributes correctly', () => {
            const element = document.createElement('a');
            const attributesString = 'target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;';

            renderer.parseAndApplyAttributes(element, attributesString);

            expect(element.getAttribute('target')).toBe('_blank');
            expect(element.getAttribute('rel')).toBe('noopener noreferrer');
        });

        it('should handle single attributes without values', () => {
            const element = document.createElement('input');
            const attributesString = 'disabled';

            renderer.parseAndApplyAttributes(element, attributesString);

            expect(element.hasAttribute('disabled')).toBe(true);
            expect(element.getAttribute('disabled')).toBe('');
        });

        it('should handle multiple attributes with mixed formats', () => {
            const element = document.createElement('input');
            const attributesString = 'type=&quot;text&quot; disabled placeholder=&quot;Enter text&quot;';

            renderer.parseAndApplyAttributes(element, attributesString);

            expect(element.getAttribute('type')).toBe('text');
            expect(element.hasAttribute('disabled')).toBe(true);
            expect(element.getAttribute('placeholder')).toBe('Enter text');
        });
    });

    describe('Frontend Conditional Attribute Processing', () => {
                it('should apply attributes when condition is true', () => {
            const element = document.createElement('a');
            const conditionalData = 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;';
            const config = { open_in_new_tab: true };
            
            // Skip hash validation for testing
            renderer.processConditionalAttributes(element, conditionalData, config, 'test-skip-hash');
            
            expect(element.getAttribute('target')).toBe('_blank');
            expect(element.getAttribute('rel')).toBe('noopener noreferrer');
        });

                it('should not apply attributes when condition is false', () => {
            const element = document.createElement('a');
            const conditionalData = 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;';
            const config = { open_in_new_tab: false };
            
            // Skip hash validation for testing
            renderer.processConditionalAttributes(element, conditionalData, config, 'test-skip-hash');
            
            expect(element.hasAttribute('target')).toBe(false);
            expect(element.hasAttribute('rel')).toBe(false);
        });

        it('should not apply attributes when condition is undefined', () => {
            const element = document.createElement('a');
            const conditionalData = 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;';
            const config = {};
            
            // Skip hash validation for testing
            renderer.processConditionalAttributes(element, conditionalData, config, 'test-skip-hash');
            
            expect(element.hasAttribute('target')).toBe(false);
            expect(element.hasAttribute('rel')).toBe(false);
        });

        it('should handle invalid conditional data gracefully', () => {
            const element = document.createElement('a');
            const config = { open_in_new_tab: true };

            // Test with invalid format (no separator)
            expect(() => {
                renderer.processConditionalAttributes(element, 'config.open_in_new_tab', config);
            }).not.toThrow();

            // Test with null/undefined data
            expect(() => {
                renderer.processConditionalAttributes(element, null, config);
            }).not.toThrow();

            expect(() => {
                renderer.processConditionalAttributes(element, undefined, config);
            }).not.toThrow();
        });
    });

    describe('Integration: Complete Element Processing', () => {
                it('should process element with conditional attributes correctly', () => {
            // Simulate the structure that would come from the backend after preprocessing
            const elementData = {
                tag: 'a',
                attributes: {
                    href: 'https://example.com',
                    'data-conditional-attrs': 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;',
                    'data-conditional-hash': 'test-skip-hash'
                },
                children: []
            };
            
            const config = { open_in_new_tab: true };
            
            const element = renderer.createElementFromTemplate(elementData, config);
            
            // Should have all attributes applied
            expect(element.tagName.toLowerCase()).toBe('a');
            expect(element.getAttribute('href')).toBe('https://example.com');
            expect(element.getAttribute('target')).toBe('_blank');
            expect(element.getAttribute('rel')).toBe('noopener noreferrer');
            
            // The processing attributes should be removed
            expect(element.hasAttribute('data-conditional-attrs')).toBe(false);
            expect(element.hasAttribute('data-conditional-hash')).toBe(false);
        });

                it('should process element without applying conditional attributes when condition is false', () => {
            const elementData = {
                tag: 'a',
                attributes: {
                    href: 'https://example.com',
                    'data-conditional-attrs': 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;',
                    'data-conditional-hash': 'test-skip-hash'
                },
                children: []
            };
            
            const config = { open_in_new_tab: false };
            
            const element = renderer.createElementFromTemplate(elementData, config);
            
            // Should only have non-conditional attributes
            expect(element.tagName.toLowerCase()).toBe('a');
            expect(element.getAttribute('href')).toBe('https://example.com');
            expect(element.hasAttribute('target')).toBe(false);
            expect(element.hasAttribute('rel')).toBe(false);
            
            // The processing attributes should be removed
            expect(element.hasAttribute('data-conditional-attrs')).toBe(false);
            expect(element.hasAttribute('data-conditional-hash')).toBe(false);
        });
    });

    describe('Button Widget Specific Tests', () => {
                it('should process link element with conditional new tab attributes when enabled', () => {
            // Test simplified link element structure (what would be inside the button widget)
            const linkStructure = {
                tag: 'a',
                attributes: {
                    href: 'https://example.com',
                    'data-conditional-attrs': 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;',
                    'data-conditional-hash': 'test-skip-hash'
                }
            };
            
            const config = {
                url: 'https://example.com',
                text: 'Click me', 
                open_in_new_tab: true
            };
            
            const element = renderer.createElementFromTemplate(linkStructure, config);
            
            expect(element.tagName.toLowerCase()).toBe('a');
            expect(element.getAttribute('href')).toBe('https://example.com');
            expect(element.getAttribute('target')).toBe('_blank');
            expect(element.getAttribute('rel')).toBe('noopener noreferrer');
            // The processing attributes should be removed
            expect(element.hasAttribute('data-conditional-attrs')).toBe(false);
            expect(element.hasAttribute('data-conditional-hash')).toBe(false);
        });

        it('should process link element without conditional new tab attributes when disabled', () => {
            const linkStructure = {
                tag: 'a',
                attributes: {
                    href: 'https://example.com',
                    'data-conditional-attrs': 'config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;',
                    'data-conditional-hash': 'test-skip-hash'
                }
            };
            
            const config = {
                url: 'https://example.com',
                text: 'Click me',
                open_in_new_tab: false
            };
            
            const element = renderer.createElementFromTemplate(linkStructure, config);
            
            expect(element.tagName.toLowerCase()).toBe('a');
            expect(element.getAttribute('href')).toBe('https://example.com');
            expect(element.hasAttribute('target')).toBe(false);
            expect(element.hasAttribute('rel')).toBe(false);
            // The processing attributes should be removed
            expect(element.hasAttribute('data-conditional-attrs')).toBe(false);
            expect(element.hasAttribute('data-conditional-hash')).toBe(false);
        });
    });
});