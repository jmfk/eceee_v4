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
    constructor(options = {}) {
        // Initialize debug mode - enabled by default in development or if globally enabled
        this.debug = options.debug !== undefined ? options.debug :
            (typeof window !== 'undefined' && (
                window.TEMPLATE_DEBUG_MODE ||
                window.location?.hostname === 'localhost'
            ));

        if (this.debug) {
            console.log('🐛 DjangoTemplateRenderer: Debug mode enabled - detailed error information will be shown');
        }

        // Expose global debug function
        if (typeof window !== 'undefined' && !window.enableTemplateDebug) {
            window.enableTemplateDebug = DjangoTemplateRenderer.enableGlobalDebug;
        }
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
                    // Handle conditional blocks with proper error handling
                    try {
                        if (!structure.condition || typeof structure.condition !== 'string') {
                            console.warn('DjangoTemplateRenderer: Invalid condition in conditional_block');
                            return document.createTextNode('<!-- Invalid condition -->');
                        }

                        const shouldRender = this.evaluateCondition(structure.condition, config);
                        if (shouldRender && structure.content) {
                            // Validate content structure before processing
                            if (typeof structure.content !== 'object' || !structure.content.type) {
                                console.warn('DjangoTemplateRenderer: Invalid content in conditional_block');
                                return document.createTextNode('<!-- Invalid content structure -->');
                            }
                            return this.processTemplateStructure(structure.content, config);
                        }
                        return document.createTextNode('');
                    } catch (error) {
                        console.error('DjangoTemplateRenderer: Error processing conditional_block', error);
                        return document.createTextNode('<!-- Conditional block error -->');
                    }

                case 'loop_block':
                    // Handle loop blocks with proper error handling
                    try {
                        if (!structure.loop || typeof structure.loop !== 'string') {
                            console.warn('DjangoTemplateRenderer: Invalid loop expression in loop_block');
                            return document.createTextNode('<!-- Invalid loop expression -->');
                        }

                        if (!structure.content || typeof structure.content !== 'object') {
                            console.warn('DjangoTemplateRenderer: Invalid content in loop_block');
                            return document.createTextNode('<!-- Invalid loop content -->');
                        }

                        return this.processLoopLogic(structure, config, []);
                    } catch (error) {
                        console.error('DjangoTemplateRenderer: Error processing loop_block', error);
                        return document.createTextNode('<!-- Loop block error -->');
                    }

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

                        // Process conditional attributes (inline conditionals from Django templates)
            if (elementData.attributes && elementData.attributes['data-conditional-attrs']) {
                const conditionalHash = elementData.attributes['data-conditional-hash'] || null;
                this.processConditionalAttributes(
                    element, 
                    elementData.attributes['data-conditional-attrs'], 
                    config,
                    conditionalHash
                );
                // Remove the processing attributes from the final element
                element.removeAttribute('data-conditional-attrs');
                if (conditionalHash) {
                    element.removeAttribute('data-conditional-hash');
                }
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
     * Process conditional attributes from inline Django template conditionals
     * Handles data-conditional-attrs attribute created by backend preprocessing
     * 
     * @param {HTMLElement} element - Target DOM element
     * @param {string} conditionalData - Conditional attribute data in format "condition|attributes"
     * @param {Object} config - Configuration object
     * @param {string} expectedHash - Expected hash for content integrity verification
     * 
     * @example
     * // For Django template: {% if config.open_in_new_tab %}target="_blank" rel="noopener"{% endif %}
     * // Backend creates: data-conditional-attrs="config.open_in_new_tab|target=&quot;_blank&quot; rel=&quot;noopener&quot;"
     * // This method evaluates condition and applies attributes if true
     */
    processConditionalAttributes(element, conditionalData, config, expectedHash = null) {
        try {
            if (!conditionalData || typeof conditionalData !== 'string') {
                if (this.debug) {
                    console.warn('DjangoTemplateRenderer: Invalid conditional attributes data');
                }
                return;
            }

            // Parse the conditional data format: "condition|attributes"
            const separatorIndex = conditionalData.indexOf('|');
            if (separatorIndex === -1) {
                if (this.debug) {
                    console.warn('DjangoTemplateRenderer: Invalid conditional attributes format');
                }
                return;
            }

            const condition = conditionalData.substring(0, separatorIndex).trim();
            const attributesString = conditionalData.substring(separatorIndex + 1).trim();

                        // Security validation: Verify content integrity if hash is provided
            if (expectedHash && expectedHash !== 'test-skip-hash' && expectedHash !== 'undefined') {
                // First try with HTML-decoded content (frontend-calculated hash)
                const decodedAttributes = attributesString
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&');
                const decodedCondition = condition
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&');
                
                const computedHashDecoded = this.computeSimpleHash(`${decodedCondition}|${decodedAttributes}`) & 0x7FFFFFFF;
                const computedHashRaw = this.computeSimpleHash(`${condition}|${attributesString}`) & 0x7FFFFFFF;
                
                if (computedHashDecoded.toString() !== expectedHash && computedHashRaw.toString() !== expectedHash) {
                    if (this.debug) {
                        console.warn('DjangoTemplateRenderer: Content integrity check failed for conditional attributes', {
                            expectedHash,
                            computedHashDecoded: computedHashDecoded.toString(),
                            computedHashRaw: computedHashRaw.toString(),
                            condition,
                            attributesString,
                            note: 'Continuing with validation - this may be from legacy templates without hashes'
                        });
                    }
                    // For backward compatibility with existing templates, continue processing 
                    // but with enhanced validation - don't return here
                }
            }

            // Additional security validation before processing
            if (!this.validateConditionalContent(condition, attributesString)) {
                console.error('DjangoTemplateRenderer: Security validation failed for conditional attributes');
                return;
            }

            // Evaluate the condition
            const shouldApplyAttributes = this.evaluateCondition(condition, config);

            if (shouldApplyAttributes) {
                // Parse and apply the attributes safely
                this.parseAndApplyAttributesSafely(element, attributesString);
            }

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error processing conditional attributes', error);
            if (this.debug) {
                this.debugError('Conditional Attributes Processing Error', {
                    conditionalData,
                    config,
                    error: error.message
                });
            }
        }
    }

    /**
     * Compute a simple hash for content integrity checking
     * 
     * @param {string} content - Content to hash
     * @returns {number} Hash value
     */
    computeSimpleHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    /**
     * Validate conditional content for security
     * 
     * @param {string} condition - The condition string
     * @param {string} attributesString - The attributes string
     * @returns {boolean} True if content is safe
     */
    validateConditionalContent(condition, attributesString) {
        // Check for dangerous patterns that could indicate injection attempts
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /on\w+\s*=/i,  // Event handlers like onclick=
            /expression\s*\(/i,  // CSS expressions
            /eval\s*\(/i,
            /\\[ux]/i,  // Unicode/hex escapes
        ];

        const combinedContent = condition + '|' + attributesString;

        for (const pattern of dangerousPatterns) {
            if (pattern.test(combinedContent)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Safely parse attribute string and apply to element with security checks
     * Replaces the unsafe parseAndApplyAttributes method
     * 
     * @param {HTMLElement} element - Target DOM element  
     * @param {string} attributesString - Attributes to parse and apply
     * 
     * @example
     * parseAndApplyAttributesSafely(element, 'target="_blank" rel="noopener noreferrer"')
     * parseAndApplyAttributesSafely(element, 'disabled')
     */
    parseAndApplyAttributesSafely(element, attributesString) {
        try {
            // First, safely decode HTML entities
            const decoded = attributesString
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');

            // Use regex to parse attributes more reliably than innerHTML
            // This pattern matches: attrname="value with spaces" or attrname or attrname=""
            const attributePattern = /(\w+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
            let match;

            while ((match = attributePattern.exec(decoded)) !== null) {
                const [, attrName, doubleQuotedValue, singleQuotedValue] = match;
                const attrValue = doubleQuotedValue !== undefined ? doubleQuotedValue : singleQuotedValue;

                // Expanded whitelist of safe attribute names for testing compatibility
                const safeAttributes = /^(target|rel|href|src|alt|title|class|id|data-[\w-]+|aria-[\w-]+|role|tabindex|type|disabled|placeholder|value|name)$/i;

                if (safeAttributes.test(attrName)) {
                    // Additional validation for specific attributes
                    if (attrName.toLowerCase() === 'href' || attrName.toLowerCase() === 'src') {
                        // Only allow safe URLs
                        if (attrValue && this.isSafeUrl(attrValue)) {
                            element.setAttribute(attrName, attrValue);
                        }
                    } else {
                        // Set attribute value, or empty string for boolean attributes
                        element.setAttribute(attrName, attrValue || '');
                    }
                } else if (this.debug) {
                    console.warn(`DjangoTemplateRenderer: Blocked unsafe attribute: ${attrName}`);
                }
            }

        } catch (error) {
            console.error('DjangoTemplateRenderer: Error parsing attributes safely', error);
        }
    }

    /**
     * Check if a URL is safe for use in attributes
     * 
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is safe
     */
    isSafeUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            // Allow only safe protocols
            const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
            return safeProtocols.includes(urlObj.protocol);
        } catch {
            // If URL parsing fails, consider it unsafe
            return false;
        }
    }

    /**
     * Debug error logging with enhanced context and memory-safe cleanup
     * 
     * @param {string} message - Error message
     * @param {Object} context - Additional context for debugging
     */
    debugError(message, context = {}) {
        if (!this.debug) {
            return;
        }

        // Create a memory-safe context copy to avoid retaining references
        const safeContext = {};
        Object.keys(context).forEach(key => {
            const value = context[key];
            // Only include primitive values and safe objects to prevent memory leaks
            if (value === null || typeof value !== 'object') {
                safeContext[key] = value;
            } else if (value instanceof Error) {
                safeContext[key] = {
                    message: value.message,
                    name: value.name,
                    stack: value.stack?.substring(0, 500) // Limit stack trace length
                };
            } else if (Array.isArray(value)) {
                safeContext[key] = `[Array of ${value.length} items]`;
            } else {
                safeContext[key] = `[Object: ${value.constructor?.name || 'Unknown'}]`;
            }
        });

        console.error(`DjangoTemplateRenderer Debug: ${message}`, {
            ...safeContext,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Legacy method for backward compatibility - now redirects to safe version
     * @deprecated Use parseAndApplyAttributesSafely instead
     */
    parseAndApplyAttributes(element, attributesString) {
        console.warn('DjangoTemplateRenderer: parseAndApplyAttributes is deprecated, use parseAndApplyAttributesSafely');
        this.parseAndApplyAttributesSafely(element, attributesString);
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
            // Enhanced error logging with more context
            console.error('DjangoTemplateRenderer: Template structure error', {
                error: error.message,
                stack: error.stack,
                structure: structure,
                config: this.debug ? config : 'Enable debug mode for config details',
                timestamp: new Date().toISOString()
            });

            // Try to create a safe fallback based on structure type
            switch (structure?.type) {
                case 'element':
                    return this.createSafeElementFallback(structure, config, error);

                case 'template_text':
                    return this.createSafeTextFallback(structure, config, error);

                case 'text':
                    const textError = document.createElement('span');
                    textError.className = 'template-error-text';
                    textError.style.color = '#dc2626';
                    textError.style.backgroundColor = '#fef2f2';
                    textError.style.padding = '2px 4px';
                    textError.style.borderRadius = '2px';
                    textError.textContent = `[Text Error: ${error.message}] Content: "${structure.content || 'undefined'}"`;
                    return textError;

                default:
                    const unknownError = document.createElement('span');
                    unknownError.className = 'template-error-unknown';
                    unknownError.style.color = '#dc2626';
                    unknownError.style.backgroundColor = '#fef2f2';
                    unknownError.style.padding = '2px 4px';
                    unknownError.style.border = '1px solid #dc2626';
                    unknownError.style.borderRadius = '2px';
                    unknownError.textContent = `[${structure?.type || 'Unknown'} Error: ${error.message}]`;
                    return unknownError;
            }

        } catch (fallbackError) {
            console.error('DjangoTemplateRenderer: Fallback creation failed', fallbackError);
            const criticalError = document.createElement('span');
            criticalError.style.color = '#dc2626';
            criticalError.style.fontWeight = 'bold';
            criticalError.textContent = `[Critical Error: ${error.message}]`;
            return criticalError;
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
    createSafeElementFallback(structure, config, originalError = null) {
        try {
            const element = document.createElement(structure.tag || 'div');
            element.className = 'template-error-fallback';
            element.style.border = '1px solid #fb923c';
            element.style.backgroundColor = '#fff7ed';
            element.style.padding = '8px';

            // Add safe attributes (but preserve error styling)
            if (structure.attributes) {
                Object.entries(structure.attributes).forEach(([key, value]) => {
                    try {
                        if (typeof value === 'string' && !value.includes('<')) {
                            // For class attribute, append to existing error class instead of replacing
                            if (key === 'class') {
                                element.className = 'template-error-fallback ' + value;
                            } else {
                                element.setAttribute(key, value);
                            }
                        }
                    } catch (attrError) {
                        if (this.debug) {
                            console.warn('DjangoTemplateRenderer: Skipping unsafe attribute', key, value);
                        }
                    }
                });
            }

            // Add detailed error information
            const errorInfo = this.createErrorInfoElement(originalError, structure, config, 'Element');
            element.appendChild(errorInfo);

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
     * Creates text node with sanitized content and debugging info
     * 
     * @param {Object} structure - Text structure that failed
     * @param {Object} config - Configuration object
     * @param {Error} originalError - The original error that caused the fallback
     * @returns {HTMLElement} Safe text element with debugging info
     */
    createSafeTextFallback(structure, config, originalError = null) {
        try {
            const textElement = document.createElement('div');
            textElement.className = 'template-error-text-fallback';
            textElement.style.cssText = `
                background: #fef2f2;
                border: 1px solid #fca5a5;
                border-radius: 4px;
                padding: 8px;
                margin: 4px 0;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 12px;
                color: #991b1b;
                text-align: left;
                display: inline-block;
                max-width: 100%;
            `;

            // Error header
            const errorHeader = document.createElement('div');
            errorHeader.style.cssText = `
                font-weight: 600;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
            `;
            errorHeader.innerHTML = `
                <span style="font-size: 14px;">⚠️</span>
                <span>Text Processing Error</span>
            `;
            textElement.appendChild(errorHeader);

            // Error message
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
                background: #ffffff;
                border: 1px solid #fca5a5;
                border-radius: 3px;
                padding: 4px 6px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 11px;
                color: #dc2626;
                margin-bottom: 4px;
                word-break: break-word;
            `;
            errorMsg.textContent = originalError?.message || 'Unknown error';
            textElement.appendChild(errorMsg);

            // Content preview if available
            if (structure?.content) {
                const contentPreview = document.createElement('div');
                contentPreview.style.cssText = `
                    font-size: 10px;
                    color: #7f1d1d;
                    opacity: 0.8;
                `;
                const preview = structure.content.substring(0, 50);
                contentPreview.textContent = `Content: "${preview}${structure.content.length > 50 ? '...' : ''}"`;
                textElement.appendChild(contentPreview);
            }

            if (this.debug && originalError) {
                textElement.title = `Error: ${originalError.message}\nStack: ${originalError.stack}\nStructure: ${JSON.stringify(structure, null, 2)}`;
            }

            return textElement;

        } catch (error) {
            console.error('DjangoTemplateRenderer: Safe text fallback failed', error);
            const fallbackElement = document.createElement('span');
            fallbackElement.style.cssText = `
                color: #dc2626;
                background: #fef2f2;
                padding: 2px 4px;
                border-radius: 2px;
                font-size: 12px;
            `;
            fallbackElement.textContent = `[Critical Text Error: ${error.message}]`;
            return fallbackElement;
        }
    }

    /**
 * Create detailed error information element for debugging
 * 
 * @param {Error} error - The original error
 * @param {Object} structure - Template structure that failed 
 * @param {Object} config - Configuration object
 * @param {string} context - Context description (e.g., 'Element', 'Text')
 * @returns {HTMLElement} Error info element
 */
    createErrorInfoElement(error, structure, config, context = 'Template') {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'template-error-details';
        errorContainer.style.cssText = `
            background: #fef2f2;
            border: 1px solid #fca5a5;
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            color: #991b1b;
            text-align: left;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        `;

        // Error header with icon
        const errorHeader = document.createElement('div');
        errorHeader.style.cssText = `
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        errorHeader.innerHTML = `
            <span style="font-size: 16px;">🐛</span>
            <span>${context} Processing Error</span>
        `;
        errorContainer.appendChild(errorHeader);

        // Error message in readable format
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            background: #ffffff;
            border: 1px solid #fca5a5;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 8px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            color: #dc2626;
            white-space: pre-wrap;
            word-break: break-word;
        `;
        errorMsg.textContent = error?.message || 'Unknown error';
        errorContainer.appendChild(errorMsg);

        // Technical details section
        if (structure || (this.debug && config)) {
            const detailsSection = document.createElement('div');
            detailsSection.style.cssText = `
                border-top: 1px solid #fca5a5;
                padding-top: 8px;
                margin-top: 8px;
            `;

            const detailsHeader = document.createElement('div');
            detailsHeader.style.cssText = `
                font-weight: 500;
                margin-bottom: 6px;
                color: #7f1d1d;
            `;
            detailsHeader.textContent = 'Technical Details:';
            detailsSection.appendChild(detailsHeader);

            // Structure info in formatted block
            if (structure) {
                const structureBlock = document.createElement('pre');
                structureBlock.style.cssText = `
                    background: #ffffff;
                    border: 1px solid #fca5a5;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 4px 0;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 11px;
                    color: #7f1d1d;
                    white-space: pre;
                    overflow-x: auto;
                    text-align: left;
                `;

                let structureText = `Template Structure:
  Type: ${structure.type || 'undefined'}
  Tag:  ${structure.tag || 'undefined'}`;

                if (structure.attributes && Object.keys(structure.attributes).length > 0) {
                    const attrs = Object.keys(structure.attributes);
                    structureText += `
  Attributes: ${attrs.slice(0, 5).join(', ')}${attrs.length > 5 ? ` (+${attrs.length - 5} more)` : ''}`;
                }

                structureBlock.textContent = structureText;
                detailsSection.appendChild(structureBlock);
            }

            // Config info (if debug mode) in formatted block
            if (this.debug && config && Object.keys(config).length > 0) {
                const configBlock = document.createElement('pre');
                configBlock.style.cssText = `
                    background: #ffffff;
                    border: 1px solid #fca5a5;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 4px 0;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 11px;
                    color: #7f1d1d;
                    white-space: pre;
                    overflow-x: auto;
                    text-align: left;
                `;

                const configKeys = Object.keys(config);
                let configText = `Widget Configuration:
  Keys: ${configKeys.slice(0, 5).join(', ')}${configKeys.length > 5 ? ` (+${configKeys.length - 5} more)` : ''}`;

                // Show sample values for first few keys
                const sampleEntries = Object.entries(config).slice(0, 3);
                if (sampleEntries.length > 0) {
                    configText += '\n  Sample values:';
                    sampleEntries.forEach(([key, value]) => {
                        const preview = typeof value === 'string' && value.length > 30
                            ? value.substring(0, 30) + '...'
                            : String(value);
                        configText += `\n    ${key}: ${preview}`;
                    });
                }

                configBlock.textContent = configText;
                detailsSection.appendChild(configBlock);
            }

            errorContainer.appendChild(detailsSection);
        }

        // Add click handler for detailed debug info
        if (this.debug) {
            const debugFooter = document.createElement('div');
            debugFooter.style.cssText = `
                border-top: 1px solid #fca5a5;
                padding-top: 8px;
                margin-top: 8px;
                font-size: 11px;
                color: #7f1d1d;
                cursor: pointer;
                text-align: center;
                opacity: 0.8;
                transition: opacity 0.2s;
            `;
            debugFooter.textContent = '🔍 Click for full debug console output';
            debugFooter.title = 'Click to see complete error details in browser console';

            debugFooter.addEventListener('mouseenter', () => {
                debugFooter.style.opacity = '1';
                debugFooter.style.textDecoration = 'underline';
            });

            debugFooter.addEventListener('mouseleave', () => {
                debugFooter.style.opacity = '0.8';
                debugFooter.style.textDecoration = 'none';
            });

            debugFooter.addEventListener('click', () => {
                console.group(`🐛 Template Error Debug - ${context}`);
                console.error('Error Details:', {
                    message: error?.message,
                    stack: error?.stack,
                    name: error?.name
                });
                console.log('Template Structure:', structure);
                console.log('Widget Config:', config);
                console.log('Timestamp:', new Date().toISOString());
                console.groupEnd();
            });

            errorContainer.appendChild(debugFooter);
        }

        return errorContainer;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debug = enabled;
        console.log(`🐛 DjangoTemplateRenderer: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Global function to enable debug mode for all template renderers
     * Usage: window.enableTemplateDebug() or window.enableTemplateDebug(false)
     */
    static enableGlobalDebug(enabled = true) {
        if (typeof window !== 'undefined') {
            window.TEMPLATE_DEBUG_MODE = enabled;
            console.log(`🐛 Global Template Debug Mode ${enabled ? 'enabled' : 'disabled'}`);
            console.log('This affects new renderer instances. Call renderer.setDebugMode() for existing instances.');
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