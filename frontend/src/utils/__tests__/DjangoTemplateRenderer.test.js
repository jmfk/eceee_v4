/**
 * Unit tests for DjangoTemplateRenderer
 * Tests the extracted Django template rendering functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import DjangoTemplateRenderer from '../DjangoTemplateRenderer.js';

// Mock DOM methods for Node.js testing environment
global.document = {
    createElement: vi.fn((tag) => ({
        tag,
        className: '',
        innerHTML: '',
        textContent: '',
        setAttribute: vi.fn(),
        appendChild: vi.fn(),
        nodeType: 1,
        style: {}
    })),
    createTextNode: vi.fn((text) => ({
        textContent: text,
        nodeType: 3
    })),
    createDocumentFragment: vi.fn(() => ({
        appendChild: vi.fn(),
        nodeType: 11
    }))
};

// Mock window and localStorage for development mode detection
global.window = {
    location: {
        hostname: 'localhost',
        port: '3000',
        search: ''
    }
};

global.localStorage = {
    getItem: vi.fn(() => null)
};

describe('DjangoTemplateRenderer', () => {
    let renderer;

    beforeEach(() => {
        renderer = new DjangoTemplateRenderer();
        vi.clearAllMocks();
    });

    describe('Core Template Processing', () => {
        describe('resolveTemplateVariables', () => {
            it('should resolve simple template variables', () => {
                const template = 'Hello {{ config.name }}!';
                const config = { name: 'World' };

                const result = renderer.resolveTemplateVariables(template, config);

                expect(result).toBe('Hello World!');
            });

            it('should handle missing variables gracefully', () => {
                const template = 'Hello {{ config.missing }}!';
                const config = {};

                const result = renderer.resolveTemplateVariables(template, config);

                expect(result).toBe('Hello !');
            });

            it('should handle nested properties', () => {
                const template = 'User: {{ config.user.profile.name }}';
                const config = {
                    user: {
                        profile: {
                            name: 'John Doe'
                        }
                    }
                };

                const result = renderer.resolveTemplateVariables(template, config);

                expect(result).toBe('User: John Doe');
            });

            it('should apply filters when present', () => {
                const template = 'Title: {{ config.title|default:"No Title" }}';
                const config = { title: '' };

                const result = renderer.resolveTemplateVariables(template, config);

                expect(result).toBe('Title: No Title');
            });

            it('should handle non-string input', () => {
                const result = renderer.resolveTemplateVariables(123, {});
                expect(result).toBe('123');
            });
        });

        describe('applyTemplateFilters', () => {
            it('should apply default filter', () => {
                const result = renderer.applyTemplateFilters('', 'config.title|default:"Fallback"');
                expect(result).toBe('Fallback');
            });

            it('should apply linebreaks filter', () => {
                const result = renderer.applyTemplateFilters('Line 1\nLine 2', 'config.content|linebreaks');
                expect(result).toBe('Line 1<br>Line 2');
            });

            it('should apply upper filter', () => {
                const result = renderer.applyTemplateFilters('hello', 'config.text|upper');
                expect(result).toBe('HELLO');
            });

            it('should apply lower filter', () => {
                const result = renderer.applyTemplateFilters('HELLO', 'config.text|lower');
                expect(result).toBe('hello');
            });

            it('should apply title filter', () => {
                const result = renderer.applyTemplateFilters('hello world', 'config.text|title');
                expect(result).toBe('Hello World');
            });

            it('should apply length filter', () => {
                const result = renderer.applyTemplateFilters('hello', 'config.text|length');
                expect(result).toBe('5');
            });

            it('should handle unknown filters gracefully', () => {
                const result = renderer.applyTemplateFilters('test', 'config.text|unknown');
                expect(result).toBe('test');
            });

            it('should chain multiple filters correctly', () => {
                const result = renderer.applyTemplateFilters('', 'config.title|default:"hello world"|upper');
                expect(result).toBe('HELLO WORLD');
            });

            it('should chain filters with complex arguments', () => {
                const result = renderer.applyTemplateFilters('line 1\nline 2', 'config.content|linebreaks|upper');
                expect(result).toBe('LINE 1<BR>LINE 2');
            });

            it('should chain three filters', () => {
                const result = renderer.applyTemplateFilters('', 'config.title|default:"hello world"|title|length');
                expect(result).toBe('11');
            });
        });

        describe('getNestedValue', () => {
            it('should get nested values safely', () => {
                const obj = { user: { profile: { name: 'John' } } };
                const result = renderer.getNestedValue(obj, 'user.profile.name');
                expect(result).toBe('John');
            });

            it('should return undefined for missing paths', () => {
                const obj = { user: {} };
                const result = renderer.getNestedValue(obj, 'user.profile.name');
                expect(result).toBeUndefined();
            });

            it('should block dangerous paths', () => {
                const obj = { data: 'test' };
                const result = renderer.getNestedValue(obj, '__proto__.constructor');
                expect(result).toBeUndefined();
            });

            it('should block constructor access', () => {
                const obj = { data: 'test' };
                const result = renderer.getNestedValue(obj, 'constructor');
                expect(result).toBeUndefined();
            });
        });

        describe('escapeHtml', () => {
            it('should escape HTML characters', () => {
                global.document.createElement = vi.fn(() => ({
                    textContent: '',
                    innerHTML: '',
                    set textContent(value) {
                        this._textContent = value;
                        // Simulate DOM escaping
                        this.innerHTML = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    },
                    get textContent() {
                        return this._textContent;
                    }
                }));

                const result = renderer.escapeHtml('<script>alert("xss")</script>');
                expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
            });
        });
    });

    describe('Template Logic', () => {
        describe('evaluateCondition', () => {
            it('should evaluate simple config conditions', () => {
                const config = { showElement: true };
                const result = renderer.evaluateCondition('config.showElement', config);
                expect(result).toBe(true);
            });

            it('should handle negation', () => {
                const config = { hideElement: false };
                const result = renderer.evaluateCondition('not config.hideElement', config);
                expect(result).toBe(true);
            });

            it('should handle equality comparison', () => {
                const config = { status: 'active' };
                const result = renderer.evaluateCondition('config.status == "active"', config);
                expect(result).toBe(true);
            });

            it('should handle inequality comparison', () => {
                const config = { status: 'inactive' };
                const result = renderer.evaluateCondition('config.status != "active"', config);
                expect(result).toBe(true);
            });

            it('should handle object-based conditions', () => {
                const config = { count: 5 };
                const condition = { type: 'comparison', left: 'count', operator: '>', right: 3 };
                const result = renderer.evaluateCondition(condition, config);
                expect(result).toBe(true);
            });

            it('should return false for failed evaluations', () => {
                const config = {};
                const result = renderer.evaluateCondition('config.missing.deeply.nested', config);
                expect(result).toBe(false);
            });
        });
    });

    describe('Structure Processing', () => {
        describe('processTemplateStructure', () => {
            it('should process element structures', () => {
                const structure = {
                    type: 'element',
                    tag: 'div',
                    classes: 'container {{ config.theme }}',
                    children: []
                };
                const config = { theme: 'dark' };

                const result = renderer.processTemplateStructure(structure, config);

                expect(document.createElement).toHaveBeenCalledWith('div');
                expect(result.className).toBe('container dark');
            });

            it('should process text structures', () => {
                const structure = {
                    type: 'template_text',
                    content: 'Hello {{ config.name }}'
                };
                const config = { name: 'World' };

                const result = renderer.processTemplateStructure(structure, config);

                expect(document.createTextNode).toHaveBeenCalledWith('Hello World');
            });

            it('should process static text', () => {
                const structure = {
                    type: 'text',
                    content: 'Static content'
                };

                const result = renderer.processTemplateStructure(structure, {});

                expect(document.createTextNode).toHaveBeenCalledWith('Static content');
            });

            it('should process fragments', () => {
                const structure = {
                    type: 'fragment',
                    children: [
                        { type: 'text', content: 'Child 1' },
                        { type: 'text', content: 'Child 2' }
                    ]
                };

                const result = renderer.processTemplateStructure(structure, {});

                expect(document.createDocumentFragment).toHaveBeenCalled();
            });

            it('should handle unknown structure types', () => {
                const structure = { type: 'unknown' };

                const result = renderer.processTemplateStructure(structure, {});

                expect(document.createTextNode).toHaveBeenCalledWith('[Unknown template type: unknown]');
            });
        });

        describe('processTemplateStructureWithLogic', () => {
            it('should process conditional structures', () => {
                const structure = {
                    type: 'element',
                    tag: 'div',
                    condition: 'config.show'
                };
                const config = { show: true };
                const templateTags = ['if'];

                const result = renderer.processTemplateStructureWithLogic(structure, config, templateTags);

                expect(result).toBeTruthy();
            });

            it('should skip elements when condition fails', () => {
                const structure = {
                    type: 'element',
                    tag: 'div',
                    condition: 'config.show'
                };
                const config = { show: false };
                const templateTags = ['if'];

                const result = renderer.processTemplateStructureWithLogic(structure, config, templateTags);

                expect(document.createTextNode).toHaveBeenCalledWith('');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle template structure errors gracefully', () => {
            const invalidStructure = null;
            const config = {};

            const result = renderer.processTemplateStructure(invalidStructure, config);

            expect(result.textContent).toContain('Error');
        });

        it('should create safe fallbacks for failed elements', () => {
            const structure = { type: 'element', tag: 'div' };
            const error = new Error('Test error');

            const result = renderer.handleTemplateStructureError(error, structure, {});

            expect(result).toBeTruthy();
        });
    });

    describe('Utility Methods', () => {
        it('should provide version information', () => {
            const version = renderer.getVersion();
            expect(version).toBe('1.0.0');
        });

        it('should support debug mode', () => {
            renderer.setDebugMode(true);
            expect(renderer.debug).toBe(true);

            renderer.setDebugMode(false);
            expect(renderer.debug).toBe(false);
        });

        it('should detect development mode', () => {
            const isDev = renderer.isDevelopmentMode();
            expect(isDev).toBe(true);
        });
    });

    describe('Integration Tests', () => {
        it('should render complex template with variables and logic', () => {
            // Create a more complete mock element
            const mockElement = {
                tag: 'div',
                className: '',
                innerHTML: '',
                textContent: '',
                setAttribute: vi.fn(),
                appendChild: vi.fn(),
                nodeType: 1
            };

            document.createElement.mockReturnValueOnce(mockElement);

            const structure = {
                type: 'element',
                tag: 'div',
                classes: 'widget {{ config.theme }}',
                children: [
                    {
                        type: 'template_text',
                        content: 'Welcome {{ config.name|default:"Guest" }}!'
                    }
                ]
            };
            const config = {
                theme: 'modern',
                name: 'John'
            };

            const result = renderer.processTemplateStructure(structure, config);

            expect(result.className).toBe('widget modern');
            expect(document.createTextNode).toHaveBeenCalledWith('Welcome John!');
        });

        it('should handle simple upper filter in resolveTemplateVariables', () => {
            const config = { author: 'john doe' };
            const result = renderer.resolveTemplateVariables('{{ config.author|upper }}', config);
            expect(result).toBe('JOHN DOE');
        });

        it('should handle templates with filters and defaults', () => {
            const template = '{{ config.title|default:"Default Title" }} - {{ config.author|upper }}';
            const config = { author: 'john doe' };

            const result = renderer.resolveTemplateVariables(template, config);
            expect(result).toBe('Default Title - JOHN DOE');
        });
    });
});