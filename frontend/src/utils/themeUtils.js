/**
 * Theme Utilities
 * 
 * Helper functions for working with theme data in the frontend.
 */

/**
 * Generate CSS from design groups configuration
 * @param {Object} designGroups - Design groups configuration
 * @param {Object} colors - Named colors palette
 * @param {string} scope - CSS scope selector
 * @param {string} widgetType - Optional widget type for filtering
 * @param {string} slot - Optional slot name for filtering
 * @returns {string} Generated CSS
 */
export function generateDesignGroupsCSS(designGroups, colors = {}, scope = '.theme-content', widgetType = null, slot = null) {
    if (!designGroups || !designGroups.groups) {
        return '';
    }

    const cssParts = [];

    // Find applicable groups
    const applicableGroups = designGroups.groups.filter(group => {
        const groupWidgetType = group.widget_type || group.widgetType;
        const groupSlot = group.slot;

        // Check if group applies to the current context
        const widgetMatch = groupWidgetType === null || groupWidgetType === undefined || groupWidgetType === widgetType;
        const slotMatch = groupSlot === null || groupSlot === undefined || groupSlot === slot;

        // AND relationship: both must match if specified
        return widgetMatch && slotMatch;
    });

    // Generate CSS for each applicable group
    for (const group of applicableGroups) {
        const elements = group.elements || {};

        for (const [element, styles] of Object.entries(elements)) {
            if (!styles || Object.keys(styles).length === 0) {
                continue;
            }

            const selector = `${scope} ${element}`;
            let cssRule = `${selector} {\n`;

            // Convert camelCase to kebab-case and handle special properties
            for (const [propertyName, propertyValue] of Object.entries(styles)) {
                const cssProperty = camelToKebab(propertyName);
                let value = propertyValue;

                // Handle color references (named colors from palette)
                // Check for any color-related property
                const colorProperties = ['color', 'backgroundColor', 'borderColor', 'borderLeftColor', 
                                       'borderRightColor', 'borderTopColor', 'borderBottomColor'];
                if (colorProperties.includes(propertyName) && colors[propertyValue]) {
                    value = `var(--${propertyValue})`;
                }

                // Handle list-specific properties
                if ((element === 'ul' || element === 'ol') && propertyName === 'bulletType') {
                    cssRule += `  list-style-type: ${value};\n`;
                    continue;
                }

                cssRule += `  ${cssProperty}: ${value};\n`;
            }

            cssRule += '}';
            cssParts.push(cssRule);
        }
    }

    return cssParts.join('\n\n');
}

/**
 * Generate CSS variables from colors
 * @param {Object} colors - Named colors
 * @param {string} scope - CSS scope selector
 * @returns {string} Generated CSS
 */
export function generateColorsCSS(colors, scope = '.theme-content') {
    if (!colors || Object.keys(colors).length === 0) {
        return '';
    }

    let css = `${scope} {\n`;
    for (const [name, value] of Object.entries(colors)) {
        css += `  --${name}: ${value};\n`;
    }
    css += '}';

    return css;
}

/**
 * Convert camelCase to kebab-case
 * @param {string} text - CamelCase text
 * @returns {string} kebab-case text
 */
function camelToKebab(text) {
    return text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 * @param {string} text - kebab-case text
 * @returns {string} camelCase text
 */
export function kebabToCamel(text) {
    return text.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Get color value from named color or return the value if it's already a color
 * @param {string} colorValue - Color name or value
 * @param {Object} colors - Named colors palette
 * @returns {string} Color value
 */
export function resolveColor(colorValue, colors = {}) {
    if (!colorValue) return '';

    // If it's a named color, return its value
    if (colors[colorValue]) {
        return colors[colorValue];
    }

    // Otherwise, return the value as-is (it's probably a hex/rgb/hsl value)
    return colorValue;
}

/**
 * Validate color value
 * @param {string} color - Color value to validate
 * @returns {boolean} True if valid
 */
export function isValidColor(color) {
    if (!color) return false;

    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbPattern = /^rgb\(/;
    const hslPattern = /^hsl\(/;
    const cssNamedColors = /^[a-z]+$/i;

    return (
        hexPattern.test(color) ||
        rgbPattern.test(color) ||
        hslPattern.test(color) ||
        cssNamedColors.test(color)
    );
}

/**
 * Get fallback value for missing theme elements
 * @param {string} type - Type of element (font, color, etc.)
 * @param {string} name - Element name
 * @returns {*} Fallback value
 */
export function getThemeFallback(type, name) {
    const fallbacks = {
        font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
        color: {
            primary: '#3b82f6',
            secondary: '#64748b',
            accent: '#f59e0b',
            'text-dark': '#1f2937',
            'text-light': '#6b7280',
            background: '#ffffff',
            border: '#e5e7eb',
        },
    };

    if (type === 'color') {
        return fallbacks.color[name] || '#000000';
    }

    return fallbacks[type] || '';
}

/**
 * Merge design groups (for inheritance or overrides)
 * @param {Array} baseGroups - Base design groups
 * @param {Array} overrideGroups - Override design groups
 * @returns {Array} Merged groups
 */
export function mergeDesignGroups(baseGroups = [], overrideGroups = []) {
    const merged = [...baseGroups];

    for (const overrideGroup of overrideGroups) {
        const existingIndex = merged.findIndex(
            g =>
                g.name === overrideGroup.name &&
                g.widget_type === overrideGroup.widget_type &&
                g.slot === overrideGroup.slot
        );

        if (existingIndex >= 0) {
            // Merge elements
            merged[existingIndex] = {
                ...merged[existingIndex],
                elements: {
                    ...merged[existingIndex].elements,
                    ...overrideGroup.elements,
                },
            };
        } else {
            // Add new group
            merged.push(overrideGroup);
        }
    }

    return merged;
}

/**
 * Get available widget types (for typography targeting)
 * @returns {Array} Widget type options
 */
export function getWidgetTypes() {
    return [
        { value: null, label: 'All Widgets' },
        { value: 'text_block', label: 'Text Block' },
        { value: 'html_block', label: 'HTML Block' },
        { value: 'image', label: 'Image' },
        { value: 'gallery', label: 'Gallery' },
        { value: 'button', label: 'Button' },
        { value: 'events', label: 'Events' },
        { value: 'news', label: 'News' },
        { value: 'calendar', label: 'Calendar' },
        { value: 'table', label: 'Table' },
        { value: 'form', label: 'Form' },
    ];
}

/**
 * Get supported HTML elements
 * @returns {Array} HTML element options
 */
export function getSupportedHTMLElements() {
    return [
        { tag: 'h1', label: 'Heading 1', preview: 'Large Heading' },
        { tag: 'h2', label: 'Heading 2', preview: 'Medium Heading' },
        { tag: 'h3', label: 'Heading 3', preview: 'Small Heading' },
        { tag: 'h4', label: 'Heading 4', preview: 'Smaller Heading' },
        { tag: 'h5', label: 'Heading 5', preview: 'Tiny Heading' },
        { tag: 'h6', label: 'Heading 6', preview: 'Smallest Heading' },
        { tag: 'p', label: 'Paragraph', preview: 'This is a paragraph of text.' },
        { tag: 'a', label: 'Link', preview: 'This is a link' },
        { tag: 'ul', label: 'Unordered List', preview: 'Bulleted list' },
        { tag: 'ol', label: 'Ordered List', preview: 'Numbered list' },
        { tag: 'li', label: 'List Item', preview: 'List item text' },
        { tag: 'blockquote', label: 'Blockquote', preview: 'This is a quote' },
        { tag: 'code', label: 'Inline Code', preview: 'const code = true;' },
        { tag: 'pre', label: 'Code Block', preview: 'Code block' },
        { tag: 'strong', label: 'Bold', preview: 'Bold text' },
        { tag: 'em', label: 'Italic', preview: 'Italic text' },
    ];
}

/**
 * Generate CSS class name from group name
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
 * Create pre-populated design group with default HTML elements
 * @param {string} name - Group name
 * @param {string} baseFont - Base font family (optional)
 * @returns {Object} Pre-populated group with all default elements
 */
export function createDesignGroup(name = 'New Group', baseFont = 'Inter, sans-serif') {
    return {
        name,
        className: generateClassName(name),
        widget_type: null,
        slot: null,
        elements: {
            h1: {
                font: baseFont,
                size: '2.5rem',
                lineHeight: '1.2',
                fontWeight: '700',
                marginTop: '0',
                marginBottom: '1.5rem',
                letterSpacing: 'normal',
            },
            h2: {
                font: baseFont,
                size: '2rem',
                lineHeight: '1.3',
                fontWeight: '600',
                marginTop: '0',
                marginBottom: '1.25rem',
                letterSpacing: 'normal',
            },
            h3: {
                font: baseFont,
                size: '1.75rem',
                lineHeight: '1.3',
                fontWeight: '600',
                marginTop: '0',
                marginBottom: '1rem',
                letterSpacing: 'normal',
            },
            h4: {
                font: baseFont,
                size: '1.5rem',
                lineHeight: '1.4',
                fontWeight: '500',
                marginTop: '0',
                marginBottom: '0.75rem',
                letterSpacing: 'normal',
            },
            h5: {
                font: baseFont,
                size: '1.25rem',
                lineHeight: '1.4',
                fontWeight: '500',
                marginTop: '0',
                marginBottom: '0.5rem',
                letterSpacing: 'normal',
            },
            h6: {
                font: baseFont,
                size: '1rem',
                lineHeight: '1.5',
                fontWeight: '500',
                marginTop: '0',
                marginBottom: '0.5rem',
                letterSpacing: 'normal',
            },
            p: {
                font: baseFont,
                size: '1rem',
                lineHeight: '1.6',
                marginTop: '0',
                marginBottom: '1rem',
            },
            a: {
                textDecoration: 'underline',
            },
            ul: {
                font: baseFont,
                bulletType: 'disc',
                paddingLeft: '1.5rem',
                marginBottom: '1rem',
            },
            ol: {
                font: baseFont,
                bulletType: 'decimal',
                paddingLeft: '1.5rem',
                marginBottom: '1rem',
            },
            li: {
                font: baseFont,
                marginBottom: '0.5rem',
            },
            blockquote: {
                font: baseFont,
                size: '1.125rem',
                lineHeight: '1.6',
                fontStyle: 'italic',
                paddingLeft: '1.5rem',
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
            },
            code: {
                font: 'monospace',
                size: '0.875rem',
                paddingLeft: '0.25rem',
                paddingRight: '0.25rem',
            },
            pre: {
                font: 'monospace',
                size: '0.875rem',
                lineHeight: '1.5',
                paddingLeft: '1rem',
                paddingRight: '1rem',
                marginBottom: '1rem',
            },
            strong: {
                fontWeight: '700',
            },
            em: {
                fontStyle: 'italic',
            },
        },
    };
}

/**
 * Create empty typography group (deprecated - use createTypographyGroup)
 * @param {string} name - Group name
 * @returns {Object} Empty group
 */
export function createEmptyTypographyGroup(name = 'New Group') {
    return {
        name,
        widget_type: null,
        slot: null,
        elements: {},
    };
}

/**
 * Create empty component style
 * @param {string} name - Style name
 * @returns {Object} Empty style
 */
export function createEmptyComponentStyle(name = 'new-style') {
    return {
        name: name,
        description: '',
        template: '<div>{{content}}</div>',
        css: '',
    };
}

