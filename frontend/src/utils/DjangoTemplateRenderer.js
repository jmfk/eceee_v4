/**
 * Django Template Renderer
 * 
 * A standalone vanilla JavaScript module for rendering Django template subset functionality.
 * Supports variable substitution, filters, conditional logic, and loops.
 * 
 * Features:
 * - Variable substitution: {{ config.field }}
 * - Template filters: |default, |linebreaks, |safe, |escape
 * - Conditional logic: {% if %} / {% endif %}
 * - Loop logic: {% for %} / {% endfor %}
 * - Security: XSS protection, prototype pollution prevention
 * 
 * @author eceee_v4 Development Team
 * @version 1.0.0
 */

class DjangoTemplateRenderer {
    /**
     * Create a new Django Template Renderer instance
     */
    constructor() {
        // Initialize any instance state if needed
        this.debug = false;
    }

    /**
     * Resolve Django template variables in a string
     * Replaces {{ variable }} patterns with actual values from config
     * 
     * @param {string} templateString - String containing {{ variable }} patterns
     * @param {Object} config - Configuration object containing variable values
     * @returns {string} String with variables resolved to actual values
     * 
     * @example
     * renderer.resolveTemplateVariables('Hello {{ config.name }}!', { name: 'World' })
     * // Returns: 'Hello World!'
     * 
     * @example
     * renderer.resolveTemplateVariables('{{ config.title|default:"No Title" }}', { title: '' })
     * // Returns: 'No Title'
     */
    resolveTemplateVariables(templateString, config) {
        try {
            if (typeof templateString !== 'string') {
                return String(templateString || '');
            }

            // Replace {{ config.field }} patterns with actual values
            return templateString.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
                try {
                    // Clean up the expression
                    const cleanExpression = expression.trim();

                    // Handle basic config.field access
                    if (cleanExpression.startsWith('config.')) {
                        // Apply basic Django filters if present
                        if (cleanExpression.includes('|')) {
                            // Extract just the field path (before the |)
                            const fieldPart = cleanExpression.split('|')[0].trim();
                            const fieldPath = fieldPart.substring(7); // Remove 'config.'
                            const value = this.getNestedValue(config, fieldPath);
                            return this.applyTemplateFilters(value, cleanExpression);
                        }

                        const fieldPath = cleanExpression.substring(7); // Remove 'config.'
                        const value = this.getNestedValue(config, fieldPath);
                        return value !== undefined ? String(value) : '';
                    }

                    // For non-config variables, return empty string for now
                    if (this.debug) {
                        console.warn(`DjangoTemplateRenderer: Unhandled template variable: ${cleanExpression}`);
                    }
                    return '';

                } catch (error) {
                    console.error('DjangoTemplateRenderer: Error resolving template variable', error, expression);
                    return match; // Return original if resolution fails
                }
            });

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error in resolveTemplateVariables', error);
            return templateString;
        }
    }

    /**
     * Get nested value from object using dot notation (with prototype pollution protection)
     * Safely accesses nested properties without risk of prototype pollution attacks
     * 
     * @param {Object} obj - Object to search in
     * @param {string} path - Dot-separated path (e.g., 'style.color')
     * @returns {*} Value at path or undefined if not found or blocked for security
     * 
     * @example
     * renderer.getNestedValue({ user: { profile: { name: 'John' } } }, 'user.profile.name')
     * // Returns: 'John'
     * 
     * @example
     * renderer.getNestedValue({ data: 'test' }, '__proto__.constructor')
     * // Returns: undefined (blocked for security)
     */
    getNestedValue(obj, path) {
        try {
            // Validate path to prevent prototype pollution
            if (typeof path !== 'string' || path.includes('__proto__') || path.includes('constructor') || path.includes('prototype')) {
                if (this.debug) {
                    console.warn('DjangoTemplateRenderer: Potentially dangerous path blocked:', path);
                }
                return undefined;
            }

            return path.split('.').reduce((current, key) => {
                // Additional validation on each key
                if (typeof key !== 'string' || key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    throw new Error(`Dangerous property access blocked: ${key}`);
                }

                // Only access own properties, not inherited ones
                if (current && Object.prototype.hasOwnProperty.call(current, key)) {
                    return current[key];
                }

                return undefined;
            }, obj);
        } catch (error) {
            console.error('DjangoTemplateRenderer: Error getting nested value', error, path);
            return undefined;
        }
    }

    /**
     * Apply basic Django template filters to a value
     * Supports common Django filters like default, linebreaks, safe, escape
     * 
     * @param {*} value - Value to filter
     * @param {string} expression - Full expression with filters (e.g., 'config.title|default:"No Title"')
     * @returns {string} Filtered value as string
     * 
     * @example
     * renderer.applyTemplateFilters('', 'config.title|default:"No Title"')
     * // Returns: 'No Title'
     * 
     * @example
     * renderer.applyTemplateFilters('Line 1\nLine 2', 'config.content|linebreaks')
     * // Returns: 'Line 1<br>Line 2'
     */
    applyTemplateFilters(value, expression) {
        try {
            // Split by pipes to get all filters (skip first part which is the variable)
            const parts = expression.split('|');
            if (parts.length < 2) return String(value || '');

            // Apply filters in sequence, starting with the initial value
            let result = value;

            // Process each filter from left to right
            for (let i = 1; i < parts.length; i++) {
                const filterPart = parts[i].trim();
                result = this.applySingleFilter(result, filterPart);
            }

            return result;

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error applying template filters', error);
            return String(value || '');
        }
    }

    /**
     * Apply a single filter to a value
     * 
     * @param {*} value - The value to filter
     * @param {string} filterPart - The filter specification (e.g., 'default:"No Title"')
     * @returns {string} The filtered value
     */
    applySingleFilter(value, filterPart) {
        try {
            const filterName = filterPart.split(':')[0].trim();
            const filterArg = filterPart.includes(':') ?
                filterPart.substring(filterPart.indexOf(':') + 1).replace(/^"(.*)"$/, '$1') : null;

            switch (filterName) {
                case 'default':
                    return value !== undefined && value !== null && value !== '' ? String(value) : (filterArg || '');

                case 'linebreaks':
                    return String(value || '').replace(/\n/g, '<br>');

                case 'safe':
                    // For now, just return as string - would need proper HTML escaping in production
                    return String(value || '');

                case 'escape':
                    return this.escapeHtml(String(value || ''));

                case 'upper':
                    return String(value || '').toUpperCase();

                case 'lower':
                    return String(value || '').toLowerCase();

                case 'title':
                    return String(value || '').replace(/\w\S*/g, (txt) =>
                        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
                    );

                case 'length':
                    const val = value || '';
                    return String(Array.isArray(val) ? val.length : String(val).length);

                default:
                    if (this.debug) {
                        console.warn(`DjangoTemplateRenderer: Unhandled template filter: ${filterName}`);
                    }
                    return String(value || '');
            }

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error applying single filter', error);
            return String(value || '');
        }
    }

    /**
     * Escape HTML characters to prevent XSS attacks
     * Uses DOM API for reliable HTML escaping
     * 
     * @param {string} text - Text to escape
     * @returns {string} HTML-escaped text
     * 
     * @example
     * renderer.escapeHtml('<script>alert("xss")</script>')
     * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Enable or disable debug mode for additional logging
     * 
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debug = Boolean(enabled);
    }

    /**
     * Process template structure and convert to DOM elements
     * Main dispatcher method that handles different structure types
     * 
     * @param {Object} structure - Template structure object
     * @param {Object} config - Configuration object containing variable values
     * @returns {HTMLElement|Text|DocumentFragment|null} DOM node
     * 
     * @example
     * const structure = { type: 'element', tag: 'div', children: [...] }
     * const element = renderer.processTemplateStructure(structure, config)
     */
    processTemplateStructure(structure, config) {
        try {
            if (!structure || typeof structure !== 'object') {
                throw new Error('Invalid template structure');
            }

            switch (structure.type) {
                case 'element':
                    return this.createElementFromTemplate(structure, config);

                case 'template_text':
                    return this.processTemplateText(structure, config);

                case 'text':
                    return this.processStaticText(structure);

                case 'style':
                    return this.processStyleElement(structure, config);

                case 'fragment':
                    return this.processFragment(structure, config);

                case 'conditional_block':
                    // Handle conditional blocks in standard processing too
                    const shouldRender = this.evaluateCondition(structure.condition, config);
                    if (shouldRender && structure.content) {
                        return this.processTemplateStructure(structure.content, config);
                    }
                    return document.createTextNode('');

                case 'loop_block':
                    // Handle loop blocks in standard processing too
                    return this.processLoopLogic(structure, config, []);

                default:
                    if (this.debug) {
                        console.warn(`DjangoTemplateRenderer: Unknown template structure type: ${structure.type}`);
                    }
                    return document.createTextNode(`[Unknown template type: ${structure.type}]`);
            }

        } catch (error) {
            return this.handleTemplateStructureError(error, structure, config);
        }
    }

    /**
     * Create DOM element from template element structure
     * Handles element creation, attributes, classes, and children
     * 
     * @param {Object} elementData - Template element data
     * @param {Object} config - Configuration object
     * @returns {HTMLElement} DOM element
     * 
     * @example
     * const elementData = {
     *   tag: 'div',
     *   classes: 'container {{ config.theme }}',
     *   attributes: { id: 'content' },
     *   children: [...]
     * }
     */
    createElementFromTemplate(elementData, config) {
        try {
            // Create the base element
            const element = document.createElement(elementData.tag || 'div');

            // Process classes with template variables
            if (elementData.classes) {
                const processedClasses = this.resolveTemplateVariables(elementData.classes, config);
                element.className = processedClasses;
            }

            // Process static attributes
            if (elementData.attributes) {
                Object.entries(elementData.attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }

            // Process template attributes (attributes with variables)
            if (elementData.template_attributes) {
                this.processTemplateAttributes(element, elementData.template_attributes, config);
            }

            // Process children recursively
            if (elementData.children && Array.isArray(elementData.children)) {
                elementData.children.forEach(child => {
                    const childNode = this.processTemplateStructure(child, config);
                    if (childNode) {
                        element.appendChild(childNode);
                    }
                });
            }

            return element;

        } catch (error) {
            return this.handleTemplateStructureError(error, elementData, config);
        }
    }

    /**
     * Process template attributes that contain variables
     * Resolves template variables in attribute values
     * 
     * @param {HTMLElement} element - Target DOM element
     * @param {Object} templateAttrs - Template attributes with variables
     * @param {Object} config - Configuration object
     * 
     * @example
     * const templateAttrs = {
     *   href: { value: '{{ config.url }}' },
     *   title: { value: '{{ config.title|default:"No Title" }}' }
     * }
     */
    processTemplateAttributes(element, templateAttrs, config) {
        try {
            Object.entries(templateAttrs).forEach(([attrName, attrData]) => {
                if (attrData && attrData.value) {
                    const resolvedValue = this.resolveTemplateVariables(attrData.value, config);
                    element.setAttribute(attrName, resolvedValue);
                }
            });
        } catch (error) {
            console.error('DjangoTemplateRenderer: Error processing template attributes', error);
        }
    }

    /**
     * Process template text with variable substitution
     * Creates text node with resolved template variables
     * 
     * @param {Object} textData - Template text data
     * @param {Object} config - Configuration object
     * @returns {Text} DOM text node
     * 
     * @example
     * const textData = { content: 'Hello {{ config.name }}!' }
     * const textNode = renderer.processTemplateText(textData, { name: 'World' })
     */
    processTemplateText(textData, config) {
        try {
            if (!textData.content) {
                return document.createTextNode('');
            }

            const resolvedContent = this.resolveTemplateVariables(textData.content, config);
            return document.createTextNode(resolvedContent);

        } catch (error) {
            return this.handleTemplateStructureError(error, textData, config);
        }
    }

    /**
     * Process static text (no variables)
     * Creates simple text node from static content
     * 
     * @param {Object} textData - Static text data
     * @returns {Text} DOM text node
     */
    processStaticText(textData) {
        return document.createTextNode(textData.content || '');
    }

    /**
     * Process template fragment (multiple root elements)
     * Creates document fragment containing all children
     * 
     * @param {Object} fragmentData - Fragment data with children
     * @param {Object} config - Configuration object
     * @returns {DocumentFragment} Document fragment containing all children
     * 
     * @example
     * const fragmentData = {
     *   type: 'fragment',
     *   children: [
     *     { type: 'element', tag: 'h1', ... },
     *     { type: 'element', tag: 'p', ... }
     *   ]
     * }
     */
    processFragment(fragmentData, config) {
        const fragment = document.createDocumentFragment();

        if (fragmentData.children && Array.isArray(fragmentData.children)) {
            fragmentData.children.forEach(child => {
                const childNode = this.processTemplateStructure(child, config);
                if (childNode) {
                    fragment.appendChild(childNode);
                }
            });
        }

        return fragment;
    }

    /**
     * Process style elements with template variables
     * Creates style element with resolved CSS variables
     * 
     * @param {Object} styleData - Style element data
     * @param {Object} config - Configuration object
     * @returns {HTMLStyleElement} Style element
     * 
     * @example
     * const styleData = {
     *   css: '.widget { color: {{ config.color|default:"black" }}; }'
     * }
     */
    processStyleElement(styleData, config) {
        const styleElement = document.createElement('style');

        if (styleData.css) {
            const processedCSS = this.resolveTemplateVariables(styleData.css, config);
            styleElement.textContent = processedCSS;
        }

        return styleElement;
    }

    /**
     * Handle template structure processing errors with safe fallbacks
     * Creates safe fallback elements when template processing fails
     * 
     * @param {Error} error - The error that occurred
     * @param {Object} structure - The template structure that failed
     * @param {Object} config - Configuration object
     * @returns {HTMLElement|Text} Safe fallback element
     */
    handleTemplateStructureError(error, structure, config) {
        try {
            if (this.debug) {
                console.error('DjangoTemplateRenderer: Template structure error', error, structure);
            }

            // Try to create a safe fallback based on structure type
            switch (structure?.type) {
                case 'element':
                    return this.createSafeElementFallback(structure, config);

                case 'template_text':
                    return this.createSafeTextFallback(structure, config);

                case 'text':
                    return document.createTextNode(structure.content || '[Text Error]');

                default:
                    return document.createTextNode(`[${structure?.type || 'Unknown'} Error: ${error.message}]`);
            }

        } catch (fallbackError) {
            console.error('DjangoTemplateRenderer: Fallback creation failed', fallbackError);
            return document.createTextNode(`[Critical Error: ${error.message}]`);
        }
    }

    /**
     * Create safe element fallback when element processing fails
     * Creates a visible error element with safe styling
     * 
     * @param {Object} structure - Element structure that failed
     * @param {Object} config - Configuration object
     * @returns {HTMLElement} Safe fallback element
     */
    createSafeElementFallback(structure, config) {
        try {
            const element = document.createElement(structure.tag || 'div');
            element.className = 'template-error-fallback';
            element.style.border = '1px solid #fb923c';
            element.style.backgroundColor = '#fff7ed';
            element.style.padding = '8px';

            // Add safe attributes
            if (structure.attributes) {
                Object.entries(structure.attributes).forEach(([key, value]) => {
                    try {
                        if (typeof value === 'string' && !value.includes('<')) {
                            element.setAttribute(key, value);
                        }
                    } catch (attrError) {
                        if (this.debug) {
                            console.warn('DjangoTemplateRenderer: Skipping unsafe attribute', key, value);
                        }
                    }
                });
            }

            // Add error message
            const errorMsg = document.createElement('small');
            errorMsg.className = 'text-orange-600';
            errorMsg.textContent = `[Element processing error]`;
            element.appendChild(errorMsg);

            return element;

        } catch (error) {
            console.error('DjangoTemplateRenderer: Safe element fallback failed', error);
            const div = document.createElement('div');
            div.textContent = '[Element Error]';
            return div;
        }
    }

    /**
     * Create safe text fallback when text processing fails
     * Creates text node with sanitized content
     * 
     * @param {Object} structure - Text structure that failed
     * @param {Object} config - Configuration object
     * @returns {Text} Safe text node
     */
    createSafeTextFallback(structure, config) {
        try {
            // Try to extract any text content safely
            let content = structure.content || '[Text processing error]';

            // Remove any template variables that failed to resolve
            content = content.replace(/\{\{[^}]*\}\}/g, '[Variable Error]');

            return document.createTextNode(content);

        } catch (error) {
            console.error('DjangoTemplateRenderer: Safe text fallback failed', error);
            return document.createTextNode('[Text Error]');
        }
    }

    /**
     * Process template structure with enhanced logic support
     * Handles conditional logic, loops, and enhanced template features
     * 
     * @param {Object} structure - Template structure object
     * @param {Object} config - Configuration object
     * @param {Array} templateTags - Array of template tags used in the template
     * @returns {HTMLElement|Text|DocumentFragment|null} DOM node
     * 
     * @example
     * const templateTags = ['if', 'for']
     * const element = renderer.processTemplateStructureWithLogic(structure, config, templateTags)
     */
    processTemplateStructureWithLogic(structure, config, templateTags = []) {
        try {
            if (!structure || typeof structure !== 'object') {
                throw new Error('Invalid template structure');
            }

            // Handle conditional logic first
            if (structure.condition || (templateTags.includes('if') && structure.conditionalRender)) {
                const result = this.processConditionalLogic(structure, config, templateTags);
                if (result === null) {
                    return document.createTextNode(''); // Return empty text node if condition fails
                }
                return result;
            }

            // Handle loop logic
            if (structure.loop || (templateTags.includes('for') && structure.iterable)) {
                return this.processLoopLogic(structure, config, templateTags);
            }

            // Handle enhanced template logic for existing types
            switch (structure.type) {
                case 'element':
                    return this.createElementFromTemplateWithLogic(structure, config, templateTags);

                case 'template_text':
                    // Check for conditional text rendering
                    if (structure.showIf) {
                        const shouldShow = this.evaluateCondition(structure.showIf, config);
                        if (!shouldShow) {
                            return document.createTextNode('');
                        }
                    }
                    return this.processTemplateText(structure, config);

                case 'conditional_block':
                    // Special type for conditional blocks
                    const shouldRender = this.evaluateCondition(structure.condition, config);
                    if (shouldRender && structure.content) {
                        return this.processTemplateStructureWithLogic(structure.content, config, templateTags);
                    }
                    return document.createTextNode('');

                default:
                    // Fall back to regular processing
                    return this.processTemplateStructure(structure, config);
            }

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error processing template structure with logic', error, structure);
            return document.createTextNode(`[Logic Error: ${error.message}]`);
        }
    }

    /**
     * Process conditional logic in template structure
     * Handles {% if %} template tags and conditional rendering
     * 
     * @param {Object} structure - Template structure that may contain conditionals
     * @param {Object} config - Configuration object
     * @param {Array} templateTags - Array of template tags used in the template
     * @returns {HTMLElement|Text|DocumentFragment|null} Processed element or null if condition fails
     * 
     * @example
     * const structure = { condition: 'config.showElement', type: 'element', ... }
     * const result = renderer.processConditionalLogic(structure, config, ['if'])
     */
    processConditionalLogic(structure, config, templateTags = []) {
        try {
            // Check if this structure has conditional logic
            if (structure.condition) {
                const shouldRender = this.evaluateCondition(structure.condition, config);
                if (!shouldRender) {
                    return null; // Don't render this element
                }
            }

            // Check for template tags that indicate conditional rendering
            if (templateTags.includes('if')) {
                // Look for conditional attributes or patterns in the structure
                if (structure.conditionalRender) {
                    const shouldRender = this.evaluateCondition(structure.conditionalRender, config);
                    if (!shouldRender) {
                        return null;
                    }
                }
            }

            // Process the structure normally if condition passes
            return this.processTemplateStructure(structure, config);

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error processing conditional logic', error, structure);
            return this.processTemplateStructure(structure, config); // Fallback to normal processing
        }
    }

    /**
     * Process loop logic in template structure
     * Handles {% for %} template tags and iteration
     * 
     * @param {Object} structure - Template structure that may contain loops
     * @param {Object} config - Configuration object
     * @param {Array} templateTags - Array of template tags used in the template
     * @returns {DocumentFragment} Fragment containing all loop iterations
     * 
     * @example
     * const structure = {
     *   loop: { iterable: 'config.items', variable: 'item' },
     *   template: { type: 'element', ... }
     * }
     * const fragment = renderer.processLoopLogic(structure, config, ['for'])
     */
    processLoopLogic(structure, config, templateTags = []) {
        try {
            const fragment = document.createDocumentFragment();

            // Check if this structure has loop logic
            if (structure.loop && structure.loop.iterable) {
                const iterableValue = this.getNestedValue(config, structure.loop.iterable);

                if (Array.isArray(iterableValue)) {
                    iterableValue.forEach((item, index) => {
                        // Create a new config context for this iteration
                        const iterationConfig = {
                            ...config,
                            [structure.loop.variable || 'item']: item,
                            forloop: {
                                counter: index + 1,
                                counter0: index,
                                first: index === 0,
                                last: index === iterableValue.length - 1,
                                length: iterableValue.length
                            }
                        };

                        // Process the template structure with the iteration context
                        const iterationElement = this.processTemplateStructure(structure.template, iterationConfig);
                        if (iterationElement) {
                            fragment.appendChild(iterationElement);
                        }
                    });
                }
            }

            return fragment;

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error processing loop logic', error, structure);
            return document.createDocumentFragment(); // Return empty fragment on error
        }
    }

    /**
     * Evaluate a conditional expression
     * Supports various condition formats used in Django templates
     * 
     * @param {string|Object} condition - Condition to evaluate
     * @param {Object} config - Configuration object
     * @returns {boolean} True if condition passes, false otherwise
     * 
     * @example
     * renderer.evaluateCondition('config.showTitle', { showTitle: true })
     * // Returns: true
     * 
     * @example
     * renderer.evaluateCondition('config.status == "active"', { status: 'active' })
     * // Returns: true
     * 
     * @example
     * renderer.evaluateCondition('not config.hidden', { hidden: false })
     * // Returns: true
     */
    evaluateCondition(condition, config) {
        try {
            if (typeof condition === 'string') {
                // Handle string conditions like "config.show_title" (but not comparisons)
                if (condition.startsWith('config.') && !condition.includes('==') && !condition.includes('!=')) {
                    const fieldPath = condition.substring(7); // Remove 'config.'
                    const value = this.getNestedValue(config, fieldPath);
                    return Boolean(value);
                }

                // Handle negation like "not config.hide_element"
                if (condition.startsWith('not ')) {
                    const innerCondition = condition.substring(4).trim();
                    return !this.evaluateCondition(innerCondition, config);
                }

                // Handle comparison operators
                if (condition.includes('==')) {
                    const [left, right] = condition.split('==').map(s => s.trim());
                    const leftValue = this.resolveTemplateVariables(`{{ ${left} }}`, config);
                    const rightValue = right.replace(/['"]/g, ''); // Remove quotes
                    return leftValue === rightValue;
                }

                if (condition.includes('!=')) {
                    const [left, right] = condition.split('!=').map(s => s.trim());
                    const leftValue = this.resolveTemplateVariables(`{{ ${left} }}`, config);
                    const rightValue = right.replace(/['"]/g, ''); // Remove quotes
                    return leftValue !== rightValue;
                }

                // Default: try to resolve as template variable
                const resolvedValue = this.resolveTemplateVariables(`{{ ${condition} }}`, config);
                return Boolean(resolvedValue);
            }

            if (typeof condition === 'object' && condition !== null) {
                // Handle object-based conditions
                if (condition.type === 'field_check') {
                    const value = this.getNestedValue(config, condition.field);
                    return Boolean(value);
                }

                if (condition.type === 'comparison') {
                    const leftValue = this.getNestedValue(config, condition.left);
                    const rightValue = condition.right;
                    switch (condition.operator) {
                        case '==': return leftValue == rightValue;
                        case '!=': return leftValue != rightValue;
                        case '>': return leftValue > rightValue;
                        case '<': return leftValue < rightValue;
                        case '>=': return leftValue >= rightValue;
                        case '<=': return leftValue <= rightValue;
                        default: return Boolean(leftValue);
                    }
                }
            }

            return Boolean(condition);

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error evaluating condition', error, condition);
            if (this.debug) {
                console.warn(`DjangoTemplateRenderer: Condition evaluation failed for: "${condition}" - this may indicate a configuration error`);
                console.warn('DjangoTemplateRenderer: Failed condition details:', {
                    condition,
                    error: error.message,
                    stack: error.stack?.split('\n').slice(0, 3)
                });
            }

            return false; // Fail safe - don't render if condition evaluation fails
        }
    }

    /**
     * Enhanced element creation with template logic support
     * Creates elements with conditional rendering and enhanced child processing
     * 
     * @param {Object} elementData - Template element data
     * @param {Object} config - Configuration object
     * @param {Array} templateTags - Array of template tags
     * @returns {HTMLElement|Text} DOM element or text node
     * 
     * @example
     * const elementData = {
     *   tag: 'div',
     *   showIf: 'config.isVisible',
     *   children: [...]
     * }
     * const element = renderer.createElementFromTemplateWithLogic(elementData, config, ['if'])
     */
    createElementFromTemplateWithLogic(elementData, config, templateTags = []) {
        try {
            // Check element-level conditions
            if (elementData.showIf) {
                const shouldShow = this.evaluateCondition(elementData.showIf, config);
                if (!shouldShow) {
                    return document.createTextNode(''); // Return empty text node if condition fails
                }
            }

            // Create the base element using existing method
            const element = this.createElementFromTemplate(elementData, config);

            // Enhanced children processing with logic support
            if (elementData.children && Array.isArray(elementData.children)) {
                // Clear existing children (from base method) and reprocess with logic
                element.innerHTML = '';

                elementData.children.forEach(child => {
                    const childNode = this.processTemplateStructureWithLogic(child, config, templateTags);
                    if (childNode && childNode.nodeType) {
                        element.appendChild(childNode);
                    }
                });
            }

            return element;

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error creating element with logic', error, elementData);
            const errorElement = document.createElement('div');
            errorElement.className = 'widget-error';
            errorElement.textContent = `Element Logic Error: ${error.message}`;
            return errorElement;
        }
    }

    /**
     * Check if the renderer is running in development mode
     * Used for enhanced debugging and error reporting
     * 
     * @returns {boolean} True if in development mode
     */
    isDevelopmentMode() {
        try {
            // Check various indicators of development mode
            return (
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.port === '3000' ||
                window.location.search.includes('debug=true') ||
                localStorage.getItem('djangoTemplateRenderer.debug') === 'true'
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the current version of the Django Template Renderer
     * 
     * @returns {string} Version string
     */
    getVersion() {
        return '1.0.0';
    }
}

// Export the class for use in other modules
export default DjangoTemplateRenderer;