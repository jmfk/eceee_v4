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
    // Support both old (requiresLocal) and new (allowsReplacementOnly) naming
    const replacementOnly = slotRules.allowsReplacementOnly ?? slotRules.requiresLocal

    // If inheritance not allowed or replacement-only mode, return only local widgets
    if (!slotRules.inheritanceAllowed || replacementOnly) {
        return localWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // MERGE MODE: Check if slot supports merging (new behavior)
    // If mergeMode is true, combine inherited + local widgets
    if (slotRules.mergeMode && inheritedWidgets.length > 0) {
        return [
            ...inheritedWidgets.map(w => ({ ...w, isInherited: true })),
            ...localWidgets.map(w => ({ ...w, isInherited: false }))
        ]
    }

    // REPLACEMENT BEHAVIOR (default): If slot has any local widgets, they REPLACE inherited widgets
    if (localWidgets && localWidgets.length > 0) {
        return localWidgets.map(w => ({ ...w, isInherited: false }))
    }

    // No local widgets - show inherited widgets
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
 * Logic: If slot has inherited widgets AND allows inheritance AND has no local widgets,
 * default to preview mode to show the inherited content
 * 
 * @param {string} slotName - Name of the slot
 * @param {Array} localWidgets - Local widgets for this slot
 * @param {Array} inheritedWidgets - Inherited widgets for this slot
 * @param {Object} slotRules - Slot configuration rules
 * @returns {boolean} True if should default to preview mode
 */
export function shouldSlotDefaultToPreview(slotName, localWidgets = [], inheritedWidgets = [], slotRules = {}) {
    const replacementOnly = slotRules.allowsReplacementOnly ?? slotRules.requiresLocal

    // If inheritance not allowed, always edit mode
    if (!slotRules.inheritanceAllowed || replacementOnly) {
        return false
    }

    // If no inherited widgets, default to edit mode
    if (!inheritedWidgets || inheritedWidgets.length === 0) {
        return false
    }

    // In merge mode with local widgets, show preview to see both
    if (slotRules.mergeMode && localWidgets.length > 0 && inheritedWidgets.length > 0) {
        return true
    }

    // If has local widgets (replacement mode), default to edit mode (user is editing)
    if (localWidgets && localWidgets.length > 0) {
        return false
    }

    // Has inherited widgets, allows inheritance, no local widgets -> preview
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
    const replacementOnly = slotRules.allowsReplacementOnly ?? slotRules.requiresLocal
    if (replacementOnly) {
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
    const replacementOnly = slotRules.allowsReplacementOnly ?? slotRules.requiresLocal
    return {
        slotName,
        hasInheritedWidgets: hasInheritedContent(inheritedWidgets),
        inheritedCount: inheritedWidgets.length,
        localCount: localWidgets.length,
        totalCount: localWidgets.length + (slotRules.inheritanceAllowed ? inheritedWidgets.length : 0),
        allowsInheritance: slotAllowsInheritance(slotRules),
        allowsReplacementOnly: replacementOnly || false,
        requiresLocal: replacementOnly || false, // Backward compatibility
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

        // Extract slot rules (support both old and new naming)
        const replacementOnly = slotData.allowsReplacementOnly ?? slotData.requiresLocal
        slotInheritanceRules[slotName] = {
            inheritanceAllowed: slotData.inheritanceAllowed !== false,
            allowsReplacementOnly: replacementOnly || false,
            requiresLocal: replacementOnly || false, // Backward compatibility
            mergeMode: slotData.mergeMode || false,
            hasInheritedWidgets: slotData.hasInheritedWidgets || false
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

