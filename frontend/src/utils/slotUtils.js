/**
 * Slot Utilities
 * 
 * Functions for discovering and categorizing slots from layouts and page data.
 */

/**
 * Get all unique slot names from page widgets
 * @param {Object} widgets - Widgets object { slotName: [widgets...] }
 * @returns {Array<string>} Array of slot names
 */
export function getSlotsFromWidgets(widgets = {}) {
    if (!widgets || typeof widgets !== 'object') {
        return []
    }
    
    return Object.keys(widgets).filter(slot => {
        // Filter out undefined/null slots and ensure slot has widgets
        return slot && slot !== 'undefined' && slot !== 'null' && 
               Array.isArray(widgets[slot]) && widgets[slot].length > 0
    })
}

/**
 * Get all slot names from layout slot configuration
 * @param {Object} layoutData - Layout data with slot_configuration
 * @returns {Array<string>} Array of slot names
 */
export function getSlotsFromLayout(layoutData) {
    if (!layoutData) {
        return []
    }
    
    // Handle different possible structures (snake_case from backend, camelCase from API)
    let slotConfig = layoutData.slot_configuration || layoutData.slotConfiguration;
    
    if (!slotConfig) {
        return []
    }
    
    const slots = slotConfig.slots || []
    if (!Array.isArray(slots)) {
        return []
    }
    
    const slotNames = slots.map(slot => {
        // Handle both object and string slot definitions
        if (typeof slot === 'string') return slot;
        if (typeof slot === 'object' && slot.name) return slot.name;
        return null;
    }).filter(Boolean);
    
    return slotNames;
}

/**
 * Sort slots by order (then by name if order is the same)
 * Footer always comes last regardless of order value
 * @param {Array<Object>} slots - Array of slot objects
 * @returns {Array<Object>} Sorted slots
 */
function sortSlotsByOrder(slots) {
    return [...slots].sort((a, b) => {
        // Footer always comes last
        if (a.name === 'footer') return 1;
        if (b.name === 'footer') return -1;
        
        const orderA = a.metadata?.order ?? 999;
        const orderB = b.metadata?.order ?? 999;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        // If order is the same, sort by name
        return a.name.localeCompare(b.name);
    });
}

/**
 * Categorize slots into groups
 * @param {Array<Object>} allSlots - All slots from API with metadata
 * @param {string|Array<string>} currentLayoutNameOrSlots - Current layout name or array of slot names
 * @param {Object} pageWidgets - Widgets from page data
 * @returns {Object} Categorized slots
 */
export function categorizeSlots(allSlots = [], currentLayoutNameOrSlots = [], pageWidgets = {}) {
    const slotsWithWidgets = getSlotsFromWidgets(pageWidgets)
    
    // Handle both layout name (string) and slot array
    let currentLayoutSlots = []
    if (typeof currentLayoutNameOrSlots === 'string') {
        // If it's a layout name, we need to get slots from that layout
        // For now, we'll need to fetch layout data separately or pass slots array
        // This is a limitation - caller should pass slots array
        currentLayoutSlots = []
    } else if (Array.isArray(currentLayoutNameOrSlots)) {
        currentLayoutSlots = currentLayoutNameOrSlots
    }
    
    const currentLayout = allSlots.filter(slot => 
        currentLayoutSlots.includes(slot.name)
    )
    
    const otherLayoutsWithWidgets = allSlots.filter(slot => 
        !currentLayoutSlots.includes(slot.name) && 
        slotsWithWidgets.includes(slot.name)
    )
    
    const availableSlots = allSlots.filter(slot => 
        !currentLayoutSlots.includes(slot.name) && 
        !slotsWithWidgets.includes(slot.name)
    )
    
    // Create unified list with isCurrent flag
    // Ensure we're comparing slot names correctly
    const allSlotsWithCurrentFlag = allSlots.map(slot => {
        const slotName = slot.name || slot;
        const isCurrent = Array.isArray(currentLayoutSlots) && 
                         currentLayoutSlots.length > 0 && 
                         currentLayoutSlots.includes(slotName);
        
        return {
            ...slot,
            isCurrent: isCurrent
        };
    })
    
    // Sort each category by order
    return {
        currentLayout: sortSlotsByOrder(currentLayout),
        otherLayoutsWithWidgets: sortSlotsByOrder(otherLayoutsWithWidgets),
        availableSlots: sortSlotsByOrder(availableSlots),
        all: sortSlotsByOrder(allSlots),
        allWithCurrentFlag: sortSlotsByOrder(allSlotsWithCurrentFlag), // Unified list with isCurrent flag
        withWidgets: slotsWithWidgets
    }
}

/**
 * Get slot metadata for a specific slot
 * @param {Array<Object>} allSlots - All slots from API
 * @param {string} slotName - Slot name to find
 * @returns {Object|null} Slot metadata or null
 */
export function getSlotMetadata(allSlots = [], slotName) {
    if (!slotName || !Array.isArray(allSlots)) {
        return null
    }
    
    return allSlots.find(slot => slot.name === slotName) || null
}

/**
 * Check if slot is in current layout
 * @param {string} slotName - Slot name to check
 * @param {Array<string>} currentLayoutSlots - Slots in current layout
 * @returns {boolean} True if slot is in current layout
 */
export function isSlotInCurrentLayout(slotName, currentLayoutSlots = []) {
    return currentLayoutSlots.includes(slotName)
}

/**
 * Get widget count for a slot
 * @param {Object} widgets - Widgets object
 * @param {string} slotName - Slot name
 * @returns {number} Widget count
 */
export function getSlotWidgetCount(widgets = {}, slotName) {
    if (!slotName || !widgets || !widgets[slotName]) {
        return 0
    }
    
    return Array.isArray(widgets[slotName]) ? widgets[slotName].length : 0
}

/**
 * Get all slot names (union of layout slots and slots with widgets)
 * @param {Array<Object>} allSlots - All slots from API
 * @param {Object} pageWidgets - Widgets from page data
 * @returns {Array<string>} All unique slot names
 */
export function getAllSlotNames(allSlots = [], pageWidgets = {}) {
    const layoutSlotNames = allSlots.map(slot => slot.name).filter(Boolean)
    const widgetSlotNames = getSlotsFromWidgets(pageWidgets)
    
    // Union of both sets
    return [...new Set([...layoutSlotNames, ...widgetSlotNames])]
}

/**
 * Format slot name for display
 * @param {string} slotName - Slot name
 * @returns {string} Formatted slot name
 */
export function formatSlotName(slotName) {
    if (!slotName) return ''
    
    // Convert snake_case or kebab-case to Title Case
    return slotName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
}

export default {
    getSlotsFromWidgets,
    getSlotsFromLayout,
    categorizeSlots,
    getSlotMetadata,
    isSlotInCurrentLayout,
    getSlotWidgetCount,
    getAllSlotNames,
    formatSlotName
}
