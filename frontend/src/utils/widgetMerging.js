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
    // If inheritance not allowed, return only local widgets
    if (!slotRules.inheritanceAllowed) {
        return localWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // TYPE-BASED REPLACEMENT: If inheritableTypes defined and any local widget matches, skip all inherited
    if (slotRules.inheritableTypes?.length > 0) {
        const localTypes = localWidgets.map(w => w.type);
        const hasMatchingType = slotRules.inheritableTypes.some(type =>
            localTypes.includes(type)
        );

        if (hasMatchingType) {
            // Local widget of inheritable type exists, skip all inherited widgets
            return localWidgets.map(w => ({ ...w, isInherited: false }));
        }
    }

    // MERGE MODE: Check if slot supports merging (mergeMode = inheritanceAllowed AND allowMerge)
    // If mergeMode is true, combine inherited + local widgets
    if (slotRules.mergeMode && inheritedWidgets.length > 0) {
        return [
            ...inheritedWidgets.map(w => ({ ...w, isInherited: true })),
            ...localWidgets.map(w => ({ ...w, isInherited: false }))
        ]
    }

    // REPLACEMENT MODE (allowMerge=false): Local widgets REPLACE inherited widgets
    // If slot has any local widgets, they REPLACE inherited widgets
    if (localWidgets && localWidgets.length > 0) {
        return localWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // No local widgets - show inherited widgets (until user adds local widgets to replace them)
    return inheritedWidgets.map(w => ({ ...w, isInherited: true }))
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
    if (mode === 'edit') {
        // Edit mode: show only local widgets (what can be edited)
        return localWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // Preview mode: show merged widgets
    return mergeWidgetsForSlot(localWidgets, inheritedWidgets, slotRules)
}

/**
 * Determine if a slot should default to preview mode
 * 
 * Logic:
 * - If slot has inherited widgets AND allows inheritance:
 *   - In MERGE mode: Default to EDIT mode (to encourage adding widgets that merge)
 *   - In REPLACEMENT mode: Default to PREVIEW mode if no local widgets (show inherited content)
 * 
 * @param {string} slotName - Name of the slot
 * @param {Array} localWidgets - Local widgets for this slot
 * @param {Array} inheritedWidgets - Inherited widgets for this slot
 * @param {Object} slotRules - Slot configuration rules
 * @returns {boolean} True if should default to preview mode
 */
export function shouldSlotDefaultToPreview(slotName, localWidgets = [], inheritedWidgets = [], slotRules = {}) {
    // If inheritance not allowed, always edit mode
    if (!slotRules.inheritanceAllowed) {
        return false
    }

    // If no inherited widgets, default to edit mode
    if (!inheritedWidgets || inheritedWidgets.length === 0) {
        return false
    }

    // MERGE MODE BEHAVIOR (mergeMode = inheritanceAllowed AND allowMerge):
    // In merge mode, default to EDIT mode to encourage adding widgets alongside inherited content
    // Exception: Only show preview if user has already added local widgets (to see the merged result)
    if (slotRules.mergeMode) {
        // Show preview mode only if user has added local widgets (to see both merged together)
        return localWidgets.length > 0 && inheritedWidgets.length > 0
    }

    // REPLACEMENT MODE BEHAVIOR (allowMerge=false):
    // If has local widgets, default to edit mode (user is editing local widgets that will replace inherited)
    if (localWidgets && localWidgets.length > 0) {
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

