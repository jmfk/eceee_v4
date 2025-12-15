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
 * @returns {Object} - Object with base_selectors, layout_part_selectors, and element_selectors
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
        
        if (!widgetTypes.length && !slots.length) {
            // Global - no targeting
            baseSelectors.push(scope || '');
        } else if (!widgetTypes.length && slots.length) {
            // Slot targeting only
            if (scope) {
                baseSelectors = slots.map(slot => 
                    `${scope}.slot-${normalizeForCSS(slot)}`
                );
            } else {
                baseSelectors = slots.map(slot => 
                    `.slot-${normalizeForCSS(slot)}`
                );
            }
        } else if (widgetTypes.length && !slots.length) {
            // Widget type targeting only
            if (scope) {
                baseSelectors = widgetTypes.map(wt => 
                    `${scope}.widget-type-${normalizeForCSS(wt)}`
                );
            } else {
                baseSelectors = widgetTypes.map(wt => 
                    `.widget-type-${normalizeForCSS(wt)}`
                );
            }
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
            // Part selectors combine base with part class
            layoutPartSelectors[part] = baseSelectors.map(base => 
                base ? `${base} .${part}`.trim() : `.${part}`
            );
        }
    }
    
    // Calculate element selectors
    const elementSelectors = {};
    const elements = group.elements || {};
    if (elements && Object.keys(elements).length > 0) {
        for (const element of Object.keys(elements)) {
            // Element selectors combine base with element tag
            elementSelectors[element] = baseSelectors.map(base => 
                base ? `${base} ${element}`.trim() : element
            );
        }
    }
    
    return {
        base_selectors: baseSelectors,
        layout_part_selectors: layoutPartSelectors,
        element_selectors: elementSelectors
    };
}




