/**
 * Selector Calculation Utility
 * 
 * Mirrors the backend logic from backend/webpages/models/page_theme.py
 * to calculate CSS selectors for design groups on the frontend.
 */

/**
 * Normalize a name for use in CSS class names
 * Converts to lowercase and replaces non-alphanumeric characters with hyphens
 * 
 * @param {string} name - The name to normalize
 * @returns {string} - CSS-safe class name
 */
function normalizeForCSS(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Calculate the actual CSS selectors for a design group
 * Mirrors backend logic from PageTheme.calculate_selectors_for_group()
 * 
 * @param {Object} group - Design group object
 * @param {string} scope - CSS scope selector (default: '')
 * @param {boolean} frontendScoped - If true, prepend .cms-content (default: false)
 * @returns {Object} - Object with baseSelectors, layoutPartSelectors, and elementSelectors
 */
export function calculateSelectorsForGroup(group, scope = '', frontendScoped = false) {
    // Check targeting mode
    const targetingMode = group.targetingMode || 'widget-slot';

    // Calculate base selectors
    let baseSelectors = [];

    if (targetingMode === 'css-classes') {
        // Use custom CSS selectors from targetCssClasses
        const targetCssClasses = group.targetCssClasses || '';
        if (targetCssClasses) {
            // Parse comma or newline-separated selectors
            const customSelectors = targetCssClasses
                .split(/[,\n]/)
                .map(s => s.trim())
                .filter(s => s);
            baseSelectors = customSelectors;
        } else {
            // No custom selectors specified - would apply globally
            baseSelectors = [scope || ''];
        }
    } else {
        // widget-slot mode: Build selectors from widgetTypes/slots
        let widgetTypes = group.widgetTypes || group.widget_types || [];
        if (!widgetTypes.length) {
            const singleWt = group.widgetType || group.widget_type;
            if (singleWt) {
                widgetTypes = [singleWt];
            }
        }

        let slots = group.slots || [];
        if (!slots.length && group.slot) {
            slots = [group.slot];
        }

        let variants = group.variants || [];
        if (!variants.length && group.variant) {
            variants = [group.variant];
        }

        if (!widgetTypes.length && !slots.length && !variants.length) {
            // Global - no targeting
            baseSelectors.push(scope || '');
        } else if (!widgetTypes.length && slots.length) {
            // Slot targeting only
            baseSelectors = slots.map(slot => {
                const sel = `.slot-${normalizeForCSS(slot)}`;
                return scope ? `${scope}${sel}` : sel;
            });
        } else if (widgetTypes.length && !slots.length) {
            // Widget type targeting only
            baseSelectors = widgetTypes.map(wt => {
                const sel = `.widget-type-${normalizeForCSS(wt)}`;
                return scope ? `${scope}${sel}` : sel;
            });
        } else if (!widgetTypes.length && !slots.length && variants.length) {
            // Variant targeting only
            baseSelectors.push(scope || '');
        } else {
            // Both widget type and slot targeting
            for (const wt of widgetTypes) {
                for (const slot of slots) {
                    const wtNormalized = normalizeForCSS(wt);
                    const slotNormalized = normalizeForCSS(slot);
                    if (scope) {
                        baseSelectors.push(
                            `${scope}.slot-${slotNormalized} > .widget-type-${wtNormalized}`
                        );
                    } else {
                        baseSelectors.push(
                            `.slot-${slotNormalized} > .widget-type-${wtNormalized}`
                        );
                    }
                }
            }
        }

        // Calculate variants selector string
        let variantsSelector = '';
        if (variants.length) {
            // Default to class selector (.) for all variants in frontend preview
            // TODO: In the future, we could look up the variant type from widget types metadata
            variantsSelector = variants.map(v => `.${v}`).join('');
        }

        // Apply frontend scoping if requested
        if (frontendScoped) {
            baseSelectors = baseSelectors.map(sel =>
                sel ? `.cms-content ${sel}`.trim() : '.cms-content'
            );
        }

        // Calculate layout part selectors
        const layoutPartSelectors = {};
        const layoutProperties = group.layoutProperties || {};
        if (layoutProperties && Object.keys(layoutProperties).length > 0) {
            for (const part of Object.keys(layoutProperties)) {
                // Determine relationship based on heuristic (mirrors themeUtils.js)
                const isRootElement = (part.endsWith('-widget') || part === 'container') && part !== 'content-widget';

                // Part selectors combine base with part class AND variants
                layoutPartSelectors[part] = baseSelectors.map(base => {
                    if (base) {
                        if (isRootElement) {
                            // Same element: .widget-type-x.part-widget.variant
                            return `${base}.${part}${variantsSelector}`.trim();
                        } else {
                            // Descendant: .widget-type-x .part.variant
                            return `${base} .${part}${variantsSelector}`.trim();
                        }
                    } else {
                        // Fallback for global layout parts
                        return `.${part}${variantsSelector}`.trim();
                    }
                });
            }
        }

        // Calculate element selectors
        const elementSelectors = {};
        const elements = group.elements || {};
        if (elements && Object.keys(elements).length > 0) {
            for (const element of Object.keys(elements)) {
                // Element selectors combine base with element tag AND variants
                if (variantsSelector) {
                    elementSelectors[element] = baseSelectors.map(base =>
                        base ? `${base} ${variantsSelector} ${element}`.trim() : `${variantsSelector} ${element}`
                    );
                } else {
                    elementSelectors[element] = baseSelectors.map(base =>
                        base ? `${base} ${element}`.trim() : element
                    );
                }
            }
        }

        return {
            baseSelectors: baseSelectors,
            layoutPartSelectors: layoutPartSelectors,
            elementSelectors: elementSelectors
        };
    }
}






