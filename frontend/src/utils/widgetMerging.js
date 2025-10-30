/**
 * Widget Merging Utilities
 * 
 * Provides functions for merging inherited and local widgets based on inheritance rules.
 */

/**
 * Merge inherited widgets with local widgets for a specific slot
 * 
 * REPLACEMENT BEHAVIOR: Local widgets REPLACE inherited widgets (not merge alongside)
 * - If slot has local widgets → show ONLY local widgets
 * - If slot has NO local widgets → show inherited widgets
 * 
 * @param {Array} localWidgets - Widgets defined on the current page
 * @param {Array} inheritedWidgets - Widgets inherited from parent pages
 * @param {Object} slotRules - Slot configuration rules
 * @returns {Array} Widget array with inheritance metadata
 */
export function mergeWidgetsForSlot(localWidgets = [], inheritedWidgets = [], slotRules = {}) {
    // Ensure we have valid arrays
    const safeLocalWidgets = Array.isArray(localWidgets) ? localWidgets : [];
    const safeInheritedWidgets = Array.isArray(inheritedWidgets) ? inheritedWidgets : [];

    // If inheritance not allowed, return only local widgets
    if (!slotRules.inheritanceAllowed) {
        return safeLocalWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // TYPE-BASED REPLACEMENT: If inheritableTypes defined and any local widget matches, skip all inherited
    if (slotRules.inheritableTypes?.length > 0) {
        const localTypes = safeLocalWidgets.map(w => w?.type).filter(Boolean);
        const hasMatchingType = slotRules.inheritableTypes.some(type =>
            localTypes.includes(type)
        );

        if (hasMatchingType) {
            // Local widget of inheritable type exists, skip all inherited widgets
            return safeLocalWidgets.map(w => ({ ...w, isInherited: false }));
        }
    }

    // MERGE MODE: Check if slot supports merging (mergeMode = inheritanceAllowed AND allowMerge)
    // If mergeMode is true, combine inherited + local widgets respecting inheritance_behavior
    if (slotRules.mergeMode && safeInheritedWidgets.length > 0) {
        // Categorize local widgets by inheritance behavior
        const beforeWidgets = [];
        const overrideWidgets = [];
        const afterWidgets = [];

        safeLocalWidgets.forEach(widget => {
            // Check for inheritance_behavior (snake_case from API or camelCase from frontend)
            const behavior = widget.inheritanceBehavior || widget.inheritance_behavior || 'insert_after_parent';

            if (behavior === 'override_parent') {
                overrideWidgets.push(widget);
            } else if (behavior === 'insert_before_parent') {
                beforeWidgets.push(widget);
            } else {
                // Default: insert_after_parent
                afterWidgets.push(widget);
            }
        });

        // If any override widgets exist, they replace ALL widgets
        if (overrideWidgets.length > 0) {
            return overrideWidgets.map(w => ({ ...w, isInherited: false }));
        }

        // Otherwise: before + inherited + after
        return [
            ...beforeWidgets.map(w => ({ ...w, isInherited: false })),
            ...safeInheritedWidgets.map(w => ({ ...w, isInherited: true })),
            ...afterWidgets.map(w => ({ ...w, isInherited: false }))
        ];
    }

    // REPLACEMENT MODE (allowMerge=false): Local widgets REPLACE inherited widgets
    // If slot has any local widgets, they REPLACE inherited widgets
    if (safeLocalWidgets.length > 0) {
        return safeLocalWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // No local widgets - show inherited widgets (until user adds local widgets to replace them)
    return safeInheritedWidgets.map(w => ({ ...w, isInherited: true }))
}

/**
 * Get widgets for a slot based on current mode
 * 
 * @param {string} mode - 'edit' or 'preview'
 * @param {Array} localWidgets - Widgets defined on the current page
 * @param {Array} inheritedWidgets - Widgets inherited from parent pages
 * @param {Object} slotRules - Slot configuration rules
 * @returns {Array} Widget array appropriate for the mode
 */
export function getSlotWidgetsForMode(mode, localWidgets = [], inheritedWidgets = [], slotRules = {}) {
    // Ensure we have valid arrays
    const safeLocalWidgets = Array.isArray(localWidgets) ? localWidgets : [];
    const safeInheritedWidgets = Array.isArray(inheritedWidgets) ? inheritedWidgets : [];

    if (mode === 'edit') {
        // Edit mode: show only local widgets (what can be edited)
        return safeLocalWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // Preview mode: show merged widgets
    return mergeWidgetsForSlot(safeLocalWidgets, safeInheritedWidgets, slotRules)
}

/**
 * Determine if a slot should default to preview mode
 * 
 * Logic:
 * - Respects collapse_behavior setting if provided (never, any, all)
 * - Falls back to legacy behavior based on merge mode and local widgets
 * 
 * Collapse Behavior Options:
 * - "never": Never collapse (always show in edit mode)
 * - "any": Collapse if any widgets are present (local OR inherited)
 * - "all": Collapse only if all visible widgets are inherited
 * 
 * @param {string} slotName - Name of the slot
 * @param {Array} localWidgets - Local widgets for this slot
 * @param {Array} inheritedWidgets - Inherited widgets for this slot
 * @param {Object} slotRules - Slot configuration rules
 * @returns {boolean} True if should default to preview mode
 */
export function shouldSlotDefaultToPreview(slotName, localWidgets = [], inheritedWidgets = [], slotRules = {}) {
    // Ensure we have valid arrays
    const safeLocalWidgets = Array.isArray(localWidgets) ? localWidgets : [];
    const safeInheritedWidgets = Array.isArray(inheritedWidgets) ? inheritedWidgets : [];

    // If inheritance not allowed, always edit mode
    if (!slotRules.inheritanceAllowed) {
        return false
    }

    // NEW: Respect collapseBehavior setting if provided (checked BEFORE inherited widgets check)
    if (slotRules.collapseBehavior) {
        switch (slotRules.collapseBehavior) {
            case 'never':
                // Never collapse - always show in edit mode
                return false

            case 'all':
                // Collapse only if ALL visible widgets are inherited
                // If any local widgets exist, don't collapse
                // Must have inherited widgets to collapse
                return safeLocalWidgets.length === 0 && safeInheritedWidgets.length > 0

            case 'any':
                // Collapse if ANY widgets are present (local OR inherited)
                // This allows root pages with local widgets to auto-close
                return (safeLocalWidgets.length > 0 || safeInheritedWidgets.length > 0)

            default:
                // Unknown collapse behavior - fall through to legacy logic
                break
        }
    }

    // If no inherited widgets, default to edit mode (for slots without collapseBehavior)
    if (safeInheritedWidgets.length === 0) {
        return false
    }

    // LEGACY BEHAVIOR (when collapseBehavior not specified):

    // MERGE MODE BEHAVIOR (mergeMode = inheritanceAllowed AND allowMerge):
    // In merge mode, default to EDIT mode to encourage adding widgets alongside inherited content
    // Exception: Only show preview if user has already added local widgets (to see the merged result)
    if (slotRules.mergeMode) {
        // Show preview mode only if user has added local widgets (to see both merged together)
        return safeLocalWidgets.length > 0 && safeInheritedWidgets.length > 0
    }

    // REPLACEMENT MODE BEHAVIOR (allowMerge=false):
    // If has local widgets, default to edit mode (user is editing local widgets that will replace inherited)
    if (safeLocalWidgets.length > 0) {
        return false
    }

    // Has inherited widgets, allows inheritance, no local widgets, replacement mode -> preview
    // (Show the inherited content in collapsed/preview mode)
    return true
}

/**
 * Check if a slot has inherited content
 * 
 * @param {Array} inheritedWidgets - Inherited widgets for this slot
 * @returns {boolean} True if slot has inherited widgets
 */
export function hasInheritedContent(inheritedWidgets = []) {
    return Array.isArray(inheritedWidgets) && inheritedWidgets.length > 0
}

/**
 * Check if a slot allows inheritance
 * 
 * @param {Object} slotRules - Slot configuration rules
 * @returns {boolean} True if inheritance is allowed
 */
export function slotAllowsInheritance(slotRules = {}) {
    // Support new allowMerge field (preferred) and fallback to old naming
    const allowMerge = slotRules.allowMerge ??
        !slotRules.allowsReplacementOnly ??
        !slotRules.requiresLocal ??
        true

    if (!allowMerge) {
        return false
    }
    return slotRules.inheritanceAllowed !== false
}

/**
 * Get inheritance summary for a slot
 * 
 * @param {string} slotName - Name of the slot
 * @param {Array} localWidgets - Local widgets for this slot
 * @param {Array} inheritedWidgets - Inherited widgets for this slot
 * @param {Object} slotRules - Slot configuration rules
 * @returns {Object} Summary object with inheritance metadata
 */
export function getSlotInheritanceSummary(slotName, localWidgets = [], inheritedWidgets = [], slotRules = {}) {
    // Support new allowMerge field (preferred) and fallback to old naming
    const allowMerge = slotRules.allowMerge ??
        !slotRules.allowsReplacementOnly ??
        !slotRules.requiresLocal ??
        true
    const replacementOnly = !allowMerge

    return {
        slotName,
        hasInheritedWidgets: hasInheritedContent(inheritedWidgets),
        inheritedCount: inheritedWidgets.length,
        localCount: localWidgets.length,
        totalCount: localWidgets.length + (slotRules.inheritanceAllowed ? inheritedWidgets.length : 0),
        allowsInheritance: slotAllowsInheritance(slotRules),
        allowMerge: allowMerge, // New preferred field
        allowsReplacementOnly: replacementOnly || false, // Backward compatibility
        requiresLocal: replacementOnly || false, // Backward compatibility - deprecated
        mergeMode: slotRules.mergeMode || false,
        defaultMode: shouldSlotDefaultToPreview(slotName, localWidgets, inheritedWidgets, slotRules) ? 'preview' : 'edit'
    }
}

/**
 * Transform inheritance data from API to component-friendly format
 * 
 * @param {Object} inheritanceData - Raw API response
 * @returns {Object} Transformed data with inheritedWidgets and slotRules
 */
export function transformInheritanceData(inheritanceData) {
    if (!inheritanceData || !inheritanceData.slots) {
        return {
            inheritedWidgets: {},
            slotInheritanceRules: {},
            hasInheritedContent: false
        }
    }

    const inheritedWidgets = {}
    const slotInheritanceRules = {}
    let hasInheritedContent = false

    Object.entries(inheritanceData.slots).forEach(([slotName, slotData]) => {
        // Extract inherited widgets
        inheritedWidgets[slotName] = slotData.inheritedWidgets || []

        // Extract slot rules with new allowMerge field (preferred) and fallback to old naming
        const allowMerge = slotData.allowMerge ??
            !slotData.allowsReplacementOnly ??
            !slotData.requiresLocal ??
            true
        const replacementOnly = !allowMerge

        slotInheritanceRules[slotName] = {
            inheritanceAllowed: slotData.inheritanceAllowed !== false,
            allowMerge: allowMerge, // New preferred field
            allowsReplacementOnly: replacementOnly || false, // Backward compatibility
            requiresLocal: replacementOnly || false, // Backward compatibility - deprecated
            mergeMode: slotData.mergeMode || false,
            hasInheritedWidgets: slotData.hasInheritedWidgets || false,
            inheritableTypes: slotData.inheritableTypes || [], // Widget types allowed for inheritance/replacement
            collapseBehavior: slotData.collapseBehavior, // Collapse behavior from backend (camelCase)
            slotName: slotName  // Add slotName to rules for debug logging
        }

        // Track if any slot has inherited content
        if (slotData.inheritedWidgets && slotData.inheritedWidgets.length > 0) {
            hasInheritedContent = true
        }
    })

    return {
        inheritedWidgets,
        slotInheritanceRules,
        hasInheritedContent,
        parentId: inheritanceData.parentId,
        hasParent: inheritanceData.hasParent
    }
}

export default {
    mergeWidgetsForSlot,
    getSlotWidgetsForMode,
    shouldSlotDefaultToPreview,
    hasInheritedContent,
    slotAllowsInheritance,
    getSlotInheritanceSummary,
    transformInheritanceData
}

