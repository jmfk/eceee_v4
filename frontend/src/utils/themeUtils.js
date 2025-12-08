/**
 * Theme Utilities
 * 
 * Helper functions for working with theme data in the frontend.
 */

/**
 * Default breakpoint configuration
 * Hard-coded defaults matching Tailwind/Bootstrap conventions
 */
const DEFAULT_BREAKPOINTS = {
    sm: 640,   // Tailwind sm
    md: 768,   // Tailwind md (Bootstrap md)
    lg: 1024,  // Tailwind lg (Bootstrap lg)
    xl: 1280,  // Tailwind xl (Bootstrap xl)
};

/**
 * Get breakpoints from theme or return defaults
 * @param {Object} theme - Theme object with optional breakpoints
 * @returns {Object} Breakpoint configuration
 */
export function getBreakpoints(theme) {
    if (theme && theme.breakpoints && typeof theme.breakpoints === 'object') {
        // Merge with defaults to ensure all keys exist
        return { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints };
    }
    return DEFAULT_BREAKPOINTS;
}

/**
 * Map old breakpoint names to new semantic names (backward compatibility)
 * @param {string} oldName - Old breakpoint name (mobile, tablet, desktop)
 * @returns {string} New semantic name (sm, md, lg, xl)
 */
export function mapBreakpointName(oldName) {
    const mapping = {
        'mobile': 'sm',
        'tablet': 'md',
        'desktop': 'lg',
    };
    return mapping[oldName] || oldName;
}

/**
 * Normalize a value for use as a CSS class name
 * Converts to lowercase and replaces non-alphanumeric characters with hyphens
 * @param {string} value - Value to normalize
 * @returns {string} Normalized CSS class name
 */
function normalizeForCSS(value) {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Generate CSS from design groups configuration
 * @param {Object} designGroups - Design groups configuration
 * @param {Object} colors - Named colors palette
 * @param {string} scope - CSS scope selector
 * @param {string} widgetType - Optional widget type for filtering
 * @param {string} slot - Optional slot name for filtering
 * @param {boolean} frontendScoped - If true, prepend .cms-content to all selectors
 * @param {Object} breakpoints - Breakpoint configuration (defaults to DEFAULT_BREAKPOINTS)
 * @returns {string} Generated CSS
 */
export function generateDesignGroupsCSS(designGroups, colors = {}, scope = '', widgetType = null, slot = null, frontendScoped = false, breakpoints = null) {
    // Use provided breakpoints or defaults
    const bps = breakpoints || DEFAULT_BREAKPOINTS;
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
        // Build all selector combinations using CSS classes
        let baseSelectors = [];

        // Check targeting mode
        if (group.targetingMode === 'css-classes' && group.targetCssClasses) {
            // CSS Classes mode - parse and use custom selectors
            const customSelectors = group.targetCssClasses
                .split(/[\n,]/)
                .map(s => s.trim())
                .filter(Boolean);
            baseSelectors = customSelectors;
            
            // Note: In css-classes mode, selectors are used exactly as provided
            // Frontend scoping is still applied if requested
        } else {
            // Widget/Slot mode (default)
            // Get widget types and slots (handle both new array format and old single value)
            const widgetTypes = group.widget_types?.length > 0
                ? group.widget_types
                : (group.widget_type ? [group.widget_type] : []);
            const slots = group.slots?.length > 0
                ? group.slots
                : (group.slot ? [group.slot] : []);

            if (widgetTypes.length === 0 && slots.length === 0) {
                // Global - no targeting
                baseSelectors.push(scope || '');
            } else if (widgetTypes.length === 0 && slots.length > 0) {
                // Slot targeting only
                slots.forEach(slot => {
                    const slotNormalized = normalizeForCSS(slot);
                    if (scope) {
                        baseSelectors.push(`${scope}.slot-${slotNormalized}`);
                    } else {
                        baseSelectors.push(`.slot-${slotNormalized}`);
                    }
                });
            } else if (widgetTypes.length > 0 && slots.length === 0) {
                // Widget type targeting only
                widgetTypes.forEach(type => {
                    const typeNormalized = normalizeForCSS(type);
                    if (scope) {
                        baseSelectors.push(`${scope}.widget-type-${typeNormalized}`);
                    } else {
                        baseSelectors.push(`.widget-type-${typeNormalized}`);
                    }
                });
            } else {
                // Both widget type and slot targeting (all combinations)
                // Use child combinator (>) to prevent cascading to nested widgets
                widgetTypes.forEach(type => {
                    slots.forEach(slot => {
                        const typeNormalized = normalizeForCSS(type);
                        const slotNormalized = normalizeForCSS(slot);
                        if (scope) {
                            baseSelectors.push(`${scope}.slot-${slotNormalized} > .widget-type-${typeNormalized}`);
                        } else {
                            baseSelectors.push(`.slot-${slotNormalized} > .widget-type-${typeNormalized}`);
                        }
                    });
                });
            }
        }

        // Apply frontend scoping if requested
        if (frontendScoped) {
            baseSelectors = baseSelectors.map(sel =>
                sel ? `.cms-content ${sel}`.trim() : '.cms-content'
            );
        }

        const elements = group.elements || {};

        for (const [element, styles] of Object.entries(elements)) {
            if (!styles || Object.keys(styles).length === 0) {
                continue;
            }

            // Generate element rules for all base selectors
            const elementSelectors = baseSelectors.map(base => `${base} ${element}`).join(',\n');
            let cssRule = `${elementSelectors} {\n`;

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

                // Handle font-family - wrap in quotes if contains spaces
                if (propertyName === 'fontFamily') {
                    // Split by comma to handle font stacks
                    value = value.split(',').map(font => {
                        const trimmed = font.trim();
                        // If already quoted or is a generic family, leave as-is
                        if (trimmed.startsWith('"') || trimmed.startsWith("'") ||
                            ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'].includes(trimmed)) {
                            return trimmed;
                        }
                        // If contains spaces, wrap in quotes
                        if (trimmed.includes(' ')) {
                            return `"${trimmed}"`;
                        }
                        return trimmed;
                    }).join(', ');
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

        // Generate layout properties CSS (using layout part classes)
        if (group.layoutProperties) {
            for (const [part, partBreakpoints] of Object.entries(group.layoutProperties)) {
                // Mobile-first approach: Handle each breakpoint in order
                for (const bpKey of ['sm', 'md', 'lg', 'xl']) {
                    // Get properties for this breakpoint with legacy support
                    let bpProps = {};

                    if (bpKey === 'sm') {
                        // Merge legacy formats into sm (base)
                        if (partBreakpoints.default) bpProps = { ...bpProps, ...partBreakpoints.default };
                        if (partBreakpoints.desktop) bpProps = { ...bpProps, ...partBreakpoints.desktop };
                        if (partBreakpoints.mobile) bpProps = { ...partBreakpoints.mobile, ...bpProps }; // mobile lower priority
                        if (partBreakpoints.sm) bpProps = { ...bpProps, ...partBreakpoints.sm };
                    } else if (bpKey === 'md') {
                        bpProps = partBreakpoints.md || partBreakpoints.tablet || {};
                    } else {
                        bpProps = partBreakpoints[bpKey] || {};
                    }

                    if (!bpProps || Object.keys(bpProps).length === 0) {
                        continue;
                    }

                    // Build selectors using layout part classes
                    // For widget root elements (parts ending in '-widget' or named 'container'),
                    // the widget-type class and part class are on the SAME element,
                    // so we use a same-element selector (no space).
                    // For child elements, we use descendant selectors (with space).
                    const isRootElement = part.endsWith('-widget') || part === 'container';
                    
                    const partSelectors = baseSelectors.map(base => {
                        if (base) {
                            if (isRootElement) {
                                // Root element: both classes on same div
                                // .slot-main .widget-type-{type}.{part}
                                return `${base}.${part}`;
                            } else {
                                // Child element: descendant selector
                                // .slot-main .widget-type-{type} .{part}
                                return `${base} .${part}`;
                            }
                        } else {
                            // Fallback for global layout parts
                            return `.${part}`;
                        }
                    }).join(',\n');

                    // Convert properties to CSS
                    const cssRules = [];
                    for (const [prop, value] of Object.entries(bpProps)) {
                        const cssProp = camelToKebab(prop);
                        cssRules.push(`  ${cssProp}: ${value};`);
                    }

                    // Generate CSS rule
                    if (bpKey === 'sm') {
                        // Base styles - NO media query
                        const rule = `${partSelectors} {\n${cssRules.join('\n')}\n}`;
                        cssParts.push(rule);
                    } else {
                        // Media query for larger breakpoints (mobile-first)
                        const bpPx = bps[bpKey];
                        const rule = `@media (min-width: ${bpPx}px) {\n  ${partSelectors} {\n${cssRules.map(r => `  ${r}`).join('\n')}\n  }\n}`;
                        cssParts.push(rule);
                    }
                }
            }
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
export function generateColorsCSS(colors, scope = ':root') {
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
 * Merge elements from two design groups programmatically
 * @param {Object} defaultElements - Base/default group elements
 * @param {Object} specificElements - Specific group elements to layer on top
 * @returns {Object} Merged elements with specific overriding default
 */
export function mergeGroupElements(defaultElements = {}, specificElements = {}) {
    const merged = {};

    // Get all unique element tags from both groups
    const allTags = new Set([
        ...Object.keys(defaultElements),
        ...Object.keys(specificElements)
    ]);

    // Merge styles for each tag
    for (const tag of allTags) {
        const defaultStyles = defaultElements[tag] || {};
        const specificStyles = specificElements[tag] || {};

        // Merge properties, with specific overriding default
        merged[tag] = {
            ...defaultStyles,
            ...specificStyles
        };
    }

    return merged;
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
 * @param {boolean} isDefault - Whether this is the default/base group
 * @returns {Object} Pre-populated group with all default elements
 */
export function createDesignGroup(name = 'New Group', baseFont = 'Inter, sans-serif', isDefault = false) {
    return {
        name,
        className: generateClassName(name),
        isDefault,
        widgetTypes: [],  // Array for multiple widget types
        slots: [],         // Array for multiple slots
        colorScheme: {
            background: null,
            text: null,
        },
        elements: {},
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
        widgetType: null,
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

