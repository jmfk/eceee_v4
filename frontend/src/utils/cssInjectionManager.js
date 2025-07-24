/**
 * CSS Injection Manager
 * 
 * Provides comprehensive dynamic CSS injection capabilities with:
 * - Security validation and sanitization
 * - CSS scoping to prevent conflicts
 * - Performance optimization and caching
 * - Real-time CSS updates
 * - Widget and page-specific CSS injection
 */

class CSSInjectionManager {
    constructor() {
        this.injectedStyles = new Map(); // Map of style element IDs to elements
        this.cssCache = new Map(); // Cache processed CSS
        this.scopeCounter = 0;
        this.observers = new Map(); // Mutation observers for dynamic updates

        // Performance optimization
        this.pendingInjections = new Set();
        this.batchTimeout = null;
        this.batchDelay = 16; // ~60fps

        // Security patterns (similar to backend)
        this.dangerousPatterns = [
            /javascript\s*:/gi,
            /expression\s*\(/gi,
            /vbscript\s*:/gi,
            /data\s*:\s*text\/html/gi,
            /<script/gi,
            /onload\s*=/gi,
            /onerror\s*=/gi,
            /-moz-binding/gi,
            /behavior\s*:/gi
        ];

        // Initialize cleanup on page unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.cleanup());
        }
    }

    /**
     * Generate a unique CSS scope identifier
     */
    generateScopeId(options = {}) {
        const { widgetId, pageId, slotName, type = 'css' } = options;
        const parts = [type];

        if (pageId) parts.push(`page-${pageId}`);
        if (slotName) parts.push(`slot-${slotName}`);
        if (widgetId) parts.push(`widget-${widgetId}`);

        // Add timestamp for uniqueness if needed
        if (!widgetId && !pageId && !slotName) {
            parts.push(Date.now().toString(36));
        }

        return parts.join('-');
    }

    /**
     * Validate CSS content for security risks
     */
    validateCSS(cssContent, context = 'unknown') {
        const errors = [];
        const warnings = [];

        if (!cssContent || typeof cssContent !== 'string') {
            return { isValid: true, errors, warnings };
        }

        // Size validation
        if (cssContent.length > 100 * 1024) { // 100KB limit
            errors.push('CSS content exceeds 100KB size limit');
            return { isValid: false, errors, warnings };
        }

        // Security validation
        const normalizedCSS = cssContent.toLowerCase();

        for (const pattern of this.dangerousPatterns) {
            if (pattern.test(cssContent)) {
                errors.push(`Security risk detected: ${pattern.source}`);
                return { isValid: false, errors, warnings };
            }
        }

        // Basic syntax validation
        const braceCount = (cssContent.match(/\{/g) || []).length - (cssContent.match(/\}/g) || []).length;
        if (braceCount !== 0) {
            errors.push(`Unbalanced braces: ${braceCount} unmatched`);
            return { isValid: false, errors, warnings };
        }

        // Rule count validation
        const ruleCount = (cssContent.match(/\{/g) || []).length;
        if (ruleCount > 1000) {
            warnings.push(`High rule count: ${ruleCount} rules`);
        }

        return { isValid: true, errors, warnings };
    }

    /**
     * Sanitize CSS content by removing dangerous patterns
     */
    sanitizeCSS(cssContent) {
        if (!cssContent) return '';

        let sanitized = cssContent;

        // Remove dangerous patterns
        for (const pattern of this.dangerousPatterns) {
            sanitized = sanitized.replace(pattern, '/* REMOVED */');
        }

        // Remove potentially dangerous comments
        sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

        return sanitized.trim();
    }

    /**
     * Apply CSS scoping to prevent style conflicts
     */
    scopeCSS(cssContent, scopeId, scopeType = 'widget') {
        if (!cssContent || scopeType === 'global') {
            return cssContent;
        }

        const scopeSelector = `.${scopeId}`;
        const rules = this.parseCSRules(cssContent);
        const scopedRules = [];

        for (const rule of rules) {
            if (rule.type === 'rule') {
                const scopedSelectors = rule.selectors.map(selector => {
                    // Don't scope at-rules or pseudo-elements that should remain global
                    if (selector.startsWith('@') || selector.includes('::before') || selector.includes('::after')) {
                        return selector;
                    }

                    // Apply scoping
                    return `${scopeSelector} ${selector}`;
                });

                scopedRules.push(`${scopedSelectors.join(', ')} { ${rule.declarations} }`);
            } else {
                // Keep at-rules (media queries, etc.) as-is
                scopedRules.push(rule.content);
            }
        }

        return scopedRules.join('\n');
    }

    /**
     * Parse CSS into rules for scoping
     */
    parseCSRules(cssContent) {
        const rules = [];
        const regex = /([^{}]+)\s*\{([^{}]*)\}/g;
        let match;

        while ((match = regex.exec(cssContent)) !== null) {
            const [, selectorPart, declarations] = match;
            const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean);

            if (selectors.length > 0 && declarations.trim()) {
                rules.push({
                    type: 'rule',
                    selectors,
                    declarations: declarations.trim()
                });
            }
        }

        // Handle at-rules
        const atRuleRegex = /@[^{]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
        let atMatch;

        while ((atMatch = atRuleRegex.exec(cssContent)) !== null) {
            rules.push({
                type: 'at-rule',
                content: atMatch[0]
            });
        }

        return rules;
    }

    /**
     * Inject CSS with validation, scoping, and caching
     */
    injectCSS(options = {}) {
        const {
            css,
            id,
            scopeId = null,
            scopeType = 'global',
            context = 'unknown',
            priority = 'normal',
            enableCaching = true
        } = options;

        if (!css || !id) {
            console.warn('CSS injection requires both css content and id');
            return false;
        }

        // Check cache first
        const cacheKey = this.generateCacheKey(css, scopeId, scopeType);

        if (enableCaching && this.cssCache.has(cacheKey)) {
            const cachedCSS = this.cssCache.get(cacheKey);
            return this.createStyleElement(id, cachedCSS, priority);
        }

        // Validate CSS
        const validation = this.validateCSS(css, context);
        if (!validation.isValid) {
            console.error(`CSS validation failed for ${context}:`, validation.errors);
            return false;
        }

        // Sanitize CSS
        const sanitizedCSS = this.sanitizeCSS(css);

        // Apply scoping
        const processedCSS = scopeId ?
            this.scopeCSS(sanitizedCSS, scopeId, scopeType) :
            sanitizedCSS;

        // Cache processed CSS
        if (enableCaching) {
            this.cssCache.set(cacheKey, processedCSS);
        }

        // Create and inject style element
        return this.createStyleElement(id, processedCSS, priority);
    }

    /**
     * Create and inject style element
     */
    createStyleElement(id, cssContent, priority = 'normal') {
        // Remove existing style element with same ID
        this.removeCSS(id);

        const styleElement = document.createElement('style');
        styleElement.id = id;
        styleElement.textContent = cssContent;

        // Add data attributes for debugging
        styleElement.setAttribute('data-css-manager', 'true');
        styleElement.setAttribute('data-priority', priority);
        styleElement.setAttribute('data-injected-at', new Date().toISOString());

        // Determine insertion point based on priority
        const insertionPoint = this.getInsertionPoint(priority);

        if (insertionPoint.nextSibling) {
            document.head.insertBefore(styleElement, insertionPoint.nextSibling);
        } else {
            document.head.appendChild(styleElement);
        }

        // Track injected style
        this.injectedStyles.set(id, styleElement);

        return true;
    }

    /**
     * Get insertion point based on priority
     */
    getInsertionPoint(priority) {
        const priorityOrder = ['critical', 'high', 'normal', 'low'];
        const targetIndex = priorityOrder.indexOf(priority);

        // Find last element with same or higher priority
        const styleElements = Array.from(document.head.querySelectorAll('style[data-css-manager="true"]'));

        for (let i = styleElements.length - 1; i >= 0; i--) {
            const elementPriority = styleElements[i].getAttribute('data-priority') || 'normal';
            const elementIndex = priorityOrder.indexOf(elementPriority);

            if (elementIndex <= targetIndex) {
                return styleElements[i];
            }
        }

        // If no suitable position found, insert at the end of head
        return document.head.lastElementChild || document.head;
    }

    /**
     * Remove CSS by ID
     */
    removeCSS(id) {
        if (this.injectedStyles.has(id)) {
            const element = this.injectedStyles.get(id);
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.injectedStyles.delete(id);
            return true;
        }
        return false;
    }

    /**
     * Update existing CSS
     */
    updateCSS(id, newCSS, options = {}) {
        if (!this.injectedStyles.has(id)) {
            return this.injectCSS({ ...options, css: newCSS, id });
        }

        return this.injectCSS({ ...options, css: newCSS, id });
    }

    /**
     * Batch inject multiple CSS entries for performance
     */
    batchInjectCSS(cssEntries) {
        const results = [];

        // Clear any pending batch
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        // Process all entries
        for (const entry of cssEntries) {
            results.push(this.injectCSS(entry));
        }

        return results;
    }

    /**
     * Generate cache key
     */
    generateCacheKey(css, scopeId, scopeType) {
        const content = css + (scopeId || '') + scopeType;
        let hash = 0;

        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return hash.toString(36);
    }

    /**
     * Clear all injected CSS
     */
    clearAll() {
        for (const [id] of this.injectedStyles) {
            this.removeCSS(id);
        }
        this.cssCache.clear();
    }

    /**
     * Get information about injected styles
     */
    getInjectedStyles() {
        const styles = [];

        for (const [id, element] of this.injectedStyles) {
            styles.push({
                id,
                priority: element.getAttribute('data-priority'),
                injectedAt: element.getAttribute('data-injected-at'),
                size: element.textContent.length,
                rules: (element.textContent.match(/\{/g) || []).length
            });
        }

        return styles;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearAll();

        // Clear observers
        for (const [, observer] of this.observers) {
            observer.disconnect();
        }
        this.observers.clear();

        // Clear timeouts
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
    }

    /**
     * Enable development mode with additional debugging
     */
    enableDebugMode() {
        this.debugMode = true;

        // Log all CSS injections
        const originalInject = this.injectCSS.bind(this);
        this.injectCSS = (options) => {
            console.log('[CSS Injection]', options);
            return originalInject(options);
        };

        return this;
    }
}

// Create and export singleton instance
const cssInjectionManager = new CSSInjectionManager();

// Enable debug mode in development
if (process.env.NODE_ENV === 'development') {
    cssInjectionManager.enableDebugMode();
}

export default cssInjectionManager; 