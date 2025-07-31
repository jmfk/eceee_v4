/**
 * Enhanced Error Handling Tests
 * Test the new detailed error reporting system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import DjangoTemplateRenderer from '../DjangoTemplateRenderer.js';

describe('Enhanced Error Handling', () => {
    let renderer;
    let consoleSpy;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        renderer = new DjangoTemplateRenderer({ debug: true });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('Element Processing Errors', () => {
        it('should provide detailed error information for element failures', () => {
            const structure = {
                type: 'element',
                tag: 'button',
                attributes: {
                    class: 'btn btn-primary',
                    id: 'test-btn',
                    onclick: 'handleClick()'
                }
            };
            const config = { title: 'Test Button', color: 'blue' };
            const error = new Error('Cannot read property undefined');

            const result = renderer.createSafeElementFallback(structure, config, error);

            expect(result.tagName).toBe('BUTTON');
            // Should preserve both error class and original classes
            expect(result.className).toBe('template-error-fallback btn btn-primary');
            expect(result.classList.contains('template-error-fallback')).toBe(true);

            // Check that error details are included
            const errorDetails = result.querySelector('.template-error-details');
            expect(errorDetails).toBeTruthy();
            expect(errorDetails.textContent).toContain('Element Processing Error');
            expect(errorDetails.textContent).toContain('Cannot read property undefined');
            expect(errorDetails.textContent).toContain('Type: element');
            expect(errorDetails.textContent).toContain('Tag:  button');
            expect(errorDetails.textContent).toContain('Attributes: class, id, onclick');
        });

        it('should include config information in debug mode', () => {
            const structure = { type: 'element', tag: 'div' };
            const config = { title: 'Test', color: 'red', size: 'large' };
            const error = new Error('Test error');

            const result = renderer.createSafeElementFallback(structure, config, error);
            const errorDetails = result.querySelector('.template-error-details');

            expect(errorDetails.textContent).toContain('Keys: title, color, size');
        });

        it('should add click handler for detailed debug info in debug mode', () => {
            const structure = { type: 'element', tag: 'span' };
            const config = { test: 'value' };
            const error = new Error('Debug test error');

            const result = renderer.createSafeElementFallback(structure, config, error);
            const errorDetails = result.querySelector('.template-error-details');

            // The click handler is on the footer element, not the container
            const debugFooter = errorDetails.querySelector('div:last-child');
            expect(debugFooter).toBeTruthy();
            expect(debugFooter.style.cursor).toBe('pointer');
            expect(debugFooter.title).toContain('Click to see complete error details');
        });
    });

    describe('Text Processing Errors', () => {
        it('should provide detailed error information for text failures', () => {
            const structure = {
                type: 'template_text',
                content: 'Hello {{user.name|default:\"Guest\"}} welcome to our site!'
            };
            const config = { user: null };
            const error = new Error('Cannot access property of null');

            const result = renderer.createSafeTextFallback(structure, config, error);

            expect(result.tagName).toBe('DIV');
            expect(result.classList.contains('template-error-text-fallback')).toBe(true);
            expect(result.textContent).toContain('Text Processing Error');
            expect(result.textContent).toContain('Cannot access property of null');
            expect(result.textContent).toContain('Hello {{user.name|default:\"Guest\"}} welcome to our...');
        });

        it('should truncate long content in error messages', () => {
            const longContent = 'This is a very long piece of content that should be truncated in the error message to avoid overwhelming the user with too much text';
            const structure = { type: 'template_text', content: longContent };
            const error = new Error('Processing failed');

            const result = renderer.createSafeTextFallback(structure, {}, error);

            // Check that content is truncated to 50 characters plus '...'
            expect(result.textContent).toContain('Text Processing Error');
            expect(result.textContent).toContain('Processing failed');
            expect(result.textContent).toContain('Content: "This is a very long piece of content that sh');
            expect(result.textContent).toContain('ould b...');
            expect(result.textContent).not.toContain(longContent); // Should not contain the full content
        });
    });

    describe('Template Structure Error Handling', () => {
        it('should log enhanced error information', () => {
            const structure = { type: 'element', tag: 'button' };
            const config = { title: 'Test' };
            const error = new Error('Test error');

            renderer.handleTemplateStructureError(error, structure, config);

            expect(consoleSpy).toHaveBeenCalledWith(
                'DjangoTemplateRenderer: Template structure error',
                expect.objectContaining({
                    error: 'Test error',
                    stack: expect.any(String),
                    structure: structure,
                    config: config,
                    timestamp: expect.any(String)
                })
            );
        });

        it('should create appropriate fallbacks for different structure types', () => {
            const elementStructure = { type: 'element', tag: 'div' };
            const textStructure = { type: 'template_text', content: 'test' };
            const unknownStructure = { type: 'unknown_type' };
            const error = new Error('Test error');

            const elementResult = renderer.handleTemplateStructureError(error, elementStructure, {});
            const textResult = renderer.handleTemplateStructureError(error, textStructure, {});
            const unknownResult = renderer.handleTemplateStructureError(error, unknownStructure, {});

            expect(elementResult.tagName).toBe('DIV');
            expect(textResult.tagName).toBe('DIV'); // Now returns a DIV with better formatting
            expect(unknownResult.tagName).toBe('SPAN');
            expect(unknownResult.textContent).toContain('unknown_type Error');
        });
    });

    describe('Debug Mode Control', () => {
        it('should enable debug mode', () => {
            const nonDebugRenderer = new DjangoTemplateRenderer({ debug: false });
            expect(nonDebugRenderer.debug).toBe(false);

            nonDebugRenderer.setDebugMode(true);
            expect(nonDebugRenderer.debug).toBe(true);
        });

        it('should disable config details when debug is off', () => {
            const nonDebugRenderer = new DjangoTemplateRenderer({ debug: false });
            const structure = { type: 'element', tag: 'div' };
            const config = { secret: 'data' };
            const error = new Error('Test error');

            nonDebugRenderer.handleTemplateStructureError(error, structure, config);

            expect(consoleSpy).toHaveBeenCalledWith(
                'DjangoTemplateRenderer: Template structure error',
                expect.objectContaining({
                    config: 'Enable debug mode for config details'
                })
            );
        });
    });

    describe('Global Debug Mode', () => {
        it('should set global debug mode', () => {
            // Mock window object
            global.window = { location: { hostname: 'example.com' } };

            DjangoTemplateRenderer.enableGlobalDebug(true);
            expect(window.TEMPLATE_DEBUG_MODE).toBe(true);

            const renderer = new DjangoTemplateRenderer();
            expect(renderer.debug).toBe(true);

            DjangoTemplateRenderer.enableGlobalDebug(false);
            expect(window.TEMPLATE_DEBUG_MODE).toBe(false);

            delete global.window;
        });
    });
});