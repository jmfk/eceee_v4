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
 * Determine the CSS selector for a variant based on its type defined in widget metadata.
 * Returns the selector part (e.g. '.classname' or '[attr]').
 * 
 * @param {string} variantId - Variant ID
 * @param {Array} selectedWidgetTypes - List of targeted widget type IDs
 * @param {Array} availableWidgetTypes - List of all widget metadata from registry
 * @returns {string} - CSS selector part
 */
function getVariantSelector(variantId, selectedWidgetTypes, availableWidgetTypes) {
    // Default to class selector
    let variantType = 'class';

    // Try to find the variant type in selected widget types
    if (selectedWidgetTypes && selectedWidgetTypes.length > 0 && availableWidgetTypes) {
        for (const wtType of selectedWidgetTypes) {
            const widgetMeta = availableWidgetTypes.find(wt => wt.type === wtType);
            if (widgetMeta && widgetMeta.variants) {
                const variant = widgetMeta.variants.find(v => v.id === variantId);
                if (variant) {
                    variantType = variant.type || 'class';
                    break;
                }
            }
        }
    }

    if (variantType === 'class') {
        return `.${variantId}`;
    } else if (variantType === 'attribute') {
        return `[${variantId}]`;
    } else if (variantType === 'pseudo-class') {
        return `:${variantId}`;
    }

    return `.${variantId}`;
}

/**
 * Calculate the actual CSS selectors for a design group
 * Mirrors backend logic from PageTheme.calculate_selectors_for_group()
 * 
 * @param {Object} group - Design group object
 * @param {string} scope - CSS scope selector (default: '')
 * @param {boolean} frontendScoped - If true, prepend .cms-content (default: false)
 * @param {Array} availableWidgetTypes - List of all widget metadata from registry
 * @returns {Object} - Object with baseSelectors, layoutPartSelectors, and elementSelectors
 */
export function calculateSelectorsForGroup(group, scope = '', frontendScoped = false, availableWidgetTypes = []) {
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
            slots.forEach(slot => {
                let sel = `.slot-${normalizeForCSS(slot)}`;
                if (scope) sel = `${scope}${sel}`;
                
                if (variants.length > 0) {
                    variants.forEach(v => {
                        const vSel = getVariantSelector(v, widgetTypes, availableWidgetTypes);
                        baseSelectors.push(`${sel}${vSel}`);
                    });
                } else {
                    baseSelectors.push(sel);
                }
            });
        } else if (widgetTypes.length && !slots.length) {
            // Widget type targeting only
            widgetTypes.forEach(wt => {
                let sel = `.widget-type-${normalizeForCSS(wt)}`;
                if (scope) sel = `${scope}${sel}`;
                
                if (variants.length > 0) {
                    variants.forEach(v => {
                        const vSel = getVariantSelector(v, widgetTypes, availableWidgetTypes);
                        baseSelectors.push(`${sel}${vSel}`);
                    });
                } else {
                    baseSelectors.push(sel);
                }
            });
        } else if (!widgetTypes.length && !slots.length && variants.length > 0) {
            // Variant targeting only (global variants)
            variants.forEach(v => {
                if (scope) baseSelectors.push(`${scope}.${v}`);
                else baseSelectors.push(`.${v}`);
            });
        } else {
            // Both widget type and slot targeting (and potentially variants)
            for (const wt of widgetTypes) {
                for (const slot of slots) {
                    const wtNormalized = normalizeForCSS(wt);
                    const slotNormalized = normalizeForCSS(slot);
                    let sel = `.slot-${slotNormalized} > .widget-type-${wtNormalized}`;
                    if (scope) sel = `${scope}${sel}`;
                    
                    if (variants.length > 0) {
                        variants.forEach(v => baseSelectors.push(`${sel}.${v}`));
                    } else {
                        baseSelectors.push(sel);
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
        baseSelectors: baseSelectors,
        layoutPartSelectors: layoutPartSelectors,
        elementSelectors: elementSelectors
    };
}






