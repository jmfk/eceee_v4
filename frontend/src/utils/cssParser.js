/**
 * CSS Parser Utility
 * 
 * Parse CSS text and convert to typography group elements structure
 */

/**
 * Convert kebab-case CSS property to camelCase
 * @param {string} prop - CSS property in kebab-case
 * @returns {string} Property in camelCase
 */
function kebabToCamel(prop) {
    return prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Convert camelCase property to kebab-case CSS
 * @param {string} prop - Property in camelCase
 * @returns {string} CSS property in kebab-case
 */
export function camelToKebab(prop) {
    return prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Clean CSS value (remove quotes, trim whitespace)
 * @param {string} value - CSS value
 * @returns {string} Cleaned value
 */
function cleanValue(value) {
    return value.trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Parse CSS declarations from a block (without selector)
 * @param {string} cssText - CSS declarations (e.g., "font-size: 2rem; color: blue;")
 * @returns {Object} Properties object with camelCase keys
 */
export function cssToElementProperties(cssText) {
    const properties = {};

    // Remove comments
    const cleanedCSS = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Extract property-value pairs
    const rules = cleanedCSS.match(/([a-z-]+)\s*:\s*([^;]+)/gi) || [];

    rules.forEach(rule => {
        const [prop, value] = rule.split(':').map(s => s.trim());
        if (prop && value) {
            const camelProp = kebabToCamel(prop);
            properties[camelProp] = cleanValue(value.replace(/;$/, ''));
        }
    });

    return properties;
}

/**
 * Parse complete CSS with selectors into structured rules
 * @param {string} cssText - Complete CSS with selectors
 * @returns {Array} Array of { selector, properties } objects
 */
export function parseCSSRules(cssText) {
    const rules = [];

    // Remove comments
    const cleanedCSS = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Match selector { declarations } patterns
    const rulePattern = /([^{]+)\{([^}]+)\}/g;
    let match;

    while ((match = rulePattern.exec(cleanedCSS)) !== null) {
        const selector = match[1].trim();
        const declarations = match[2].trim();

        if (selector && declarations) {
            const properties = cssToElementProperties(declarations);
            rules.push({ selector, properties });
        }
    }

    return rules;
}

/**
 * Extract element tag from a selector (h1, h2, p, a, etc.)
 * Handles selectors like "h1", ".class h1", "h1.class", "a:hover"
 * @param {string} selector - CSS selector
 * @returns {string|null} Element tag or null if not a supported element
 */
function extractElementTag(selector) {
    // Supported HTML elements with patterns to match
    const elementPatterns = [
        { element: 'h1', pattern: /(?:^|\s)h1(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'h2', pattern: /(?:^|\s)h2(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'h3', pattern: /(?:^|\s)h3(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'h4', pattern: /(?:^|\s)h4(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'h5', pattern: /(?:^|\s)h5(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'h6', pattern: /(?:^|\s)h6(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'p', pattern: /(?:^|\s)p(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'a', pattern: /(?:^|\s)a(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'ul', pattern: /(?:^|\s)ul(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'ol', pattern: /(?:^|\s)ol(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'li', pattern: /(?:^|\s)li(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'blockquote', pattern: /(?:^|\s)blockquote(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'code', pattern: /(?:^|\s)code(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'pre', pattern: /(?:^|\s)pre(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'strong', pattern: /(?:^|\s)strong(?::[\w-]+)?(?:\s|$|[.#:])/i },
        { element: 'em', pattern: /(?:^|\s)em(?::[\w-]+)?(?:\s|$|[.#:])/i },
    ];

    // Add space padding to selector for easier matching
    const paddedSelector = ` ${selector} `;

    // Try to match each element pattern
    for (const { element, pattern } of elementPatterns) {
        if (pattern.test(paddedSelector)) {
            // Extract the full element including pseudo-class if present
            const pseudoMatch = paddedSelector.match(new RegExp(`(?:^|\\s)(${element}(?::[\\w-]+)?)(?:\\s|$|[.#:])`, 'i'));
            if (pseudoMatch) {
                return pseudoMatch[1].trim();
            }
            return element;
        }
    }

    return null;
}

/**
 * Convert parsed CSS rules to typography group elements structure
 * @param {Array} cssRules - Array of { selector, properties } from parseCSSRules
 * @returns {Object} Elements object suitable for typography group
 */
export function cssToGroupElements(cssRules) {
    const elements = {};
    const warnings = [];

    cssRules.forEach(({ selector, properties }) => {
        const elementTag = extractElementTag(selector);

        if (elementTag) {
            // Merge properties if element already exists
            if (elements[elementTag]) {
                elements[elementTag] = { ...elements[elementTag], ...properties };
            } else {
                elements[elementTag] = properties;
            }
        } else {
            warnings.push(`Unsupported selector: ${selector}`);
        }
    });

    return { elements, warnings };
}

/**
 * Generate CSS class name from group name
 * Converts to lowercase, replaces spaces and special chars with hyphens
 * @param {string} name - Group name
 * @returns {string} Valid CSS class name
 */
export function generateClassName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate if a string is a valid CSS class name
 * @param {string} className - Class name to validate
 * @returns {boolean} True if valid
 */
export function isValidClassName(className) {
    // CSS class names must start with letter or underscore, 
    // followed by letters, digits, hyphens, or underscores
    return /^[a-zA-Z_][\w-]*$/.test(className);
}

/**
 * Convert typography group elements to CSS rules
 * @param {Object} elements - Typography group elements
 * @param {string} className - Optional CSS class name for scoping
 * @returns {string} CSS text
 */
export function groupElementsToCSS(elements, className = null) {
    if (!elements || Object.keys(elements).length === 0) {
        return '';
    }

    const cssRules = [];

    Object.entries(elements).forEach(([element, properties]) => {
        if (!properties || Object.keys(properties).length === 0) {
            return;
        }

        // Build selector with optional class scope
        const selector = className ? `.${className} ${element}` : element;

        // Build declarations
        const declarations = Object.entries(properties)
            .map(([prop, value]) => `  ${camelToKebab(prop)}: ${value};`)
            .join('\n');

        cssRules.push(`${selector} {\n${declarations}\n}`);
    });

    return cssRules.join('\n\n');
}

