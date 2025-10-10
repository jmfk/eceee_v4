/**
 * Dynamic Options Functions Registry
 * 
 * Provides a registry of named functions that can generate dynamic options
 * for SelectInput and other choice-based field components.
 * 
 * Each function receives context and formData and returns an array of options.
 * This allows backend Pydantic schemas to reference functions by name.
 * 
 * Usage in backend:
 * ```python
 * slot_name: str = Field(
 *     json_schema_extra={
 *         "component": "SelectInput",
 *         "optionsFunction": "getLayoutSlots"
 *     }
 * )
 * ```
 */

/**
 * Get available slots from the current page's layout
 * 
 * @param {Object} context - Full page context
 * @param {Object} formData - Current form data
 * @returns {Array} Array of {value, label} objects
 */
function getLayoutSlots(context, formData) {
    try {
        const pageVersionData = context?.pageVersionData

        if (!pageVersionData) {
            console.warn('[getLayoutSlots] No pageVersionData in context')
            return getDefaultSlots()
        }

        // Get layout name from page version
        const layoutName = pageVersionData.codeLayout

        if (!layoutName) {
            console.warn('[getLayoutSlots] No codeLayout found in pageVersionData')
            return getDefaultSlots()
        }

        // Get current widgets to discover which slots have widgets
        const widgets = pageVersionData.widgets || {}
        const slotsWithWidgets = Object.keys(widgets).filter(slot => {
            // Filter out slots without widgets and 'undefined' slot
            return slot !== 'undefined' && widgets[slot] && widgets[slot].length > 0
        })

        // Common layout slots (fallback if no widgets yet)
        const commonSlots = ['main', 'sidebar', 'header', 'footer', 'content']

        // Combine discovered slots with common slots (deduplicated)
        const allSlots = [...new Set([...slotsWithWidgets, ...commonSlots])]

        // Format as options
        return allSlots.map(slot => ({
            value: slot,
            label: capitalizeFirst(slot)
        })).sort((a, b) => a.label.localeCompare(b.label))

    } catch (error) {
        console.error('[getLayoutSlots] Error:', error)
        return getDefaultSlots()
    }
}

/**
 * Helper: Get default slots as fallback
 */
function getDefaultSlots() {
    return [
        { value: 'main', label: 'Main' },
        { value: 'sidebar', label: 'Sidebar' },
        { value: 'header', label: 'Header' },
        { value: 'footer', label: 'Footer' },
        { value: 'content', label: 'Content' },
    ]
}

/**
 * Helper: Capitalize first letter
 */
function capitalizeFirst(str) {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get available widget types
 * 
 * @param {Object} context - Full page context
 * @param {Object} formData - Current form data
 * @returns {Array} Array of {value, label} objects
 */
function getWidgetTypes(context, formData) {
    // TODO: Implement when needed
    // Could call widgetTypesApi or read from cached data
    return []
}

/**
 * Get available namespaces
 * 
 * @param {Object} context - Full page context
 * @param {Object} formData - Current form data
 * @returns {Array} Array of {value, label} objects
 */
function getNamespaces(context, formData) {
    // TODO: Implement when needed
    return []
}

/**
 * Get available themes
 * 
 * @param {Object} context - Full page context
 * @param {Object} formData - Current form data
 * @returns {Array} Array of {value, label} objects
 */
function getThemes(context, formData) {
    // TODO: Implement when needed
    return []
}

/**
 * OPTIONS_FUNCTIONS Registry
 * 
 * Maps function names to implementations.
 * Add new functions here to make them available in backend schemas.
 */
export const OPTIONS_FUNCTIONS = {
    getLayoutSlots,
    getWidgetTypes,
    getNamespaces,
    getThemes,
}

/**
 * Execute an options function by name
 * 
 * @param {string} functionName - Name of the function to execute
 * @param {Object} context - Full page/object context
 * @param {Object} formData - Current form data
 * @returns {Array} Array of {value, label} options, or empty array if function not found
 */
export function executeOptionsFunction(functionName, context = {}, formData = {}) {
    if (!functionName) {
        console.warn('[executeOptionsFunction] No function name provided')
        return []
    }

    const fn = OPTIONS_FUNCTIONS[functionName]

    if (!fn) {
        console.warn(`[executeOptionsFunction] Function '${functionName}' not found in OPTIONS_FUNCTIONS registry`)
        return []
    }

    try {
        const result = fn(context, formData)

        // Validate result format
        if (!Array.isArray(result)) {
            console.error(`[executeOptionsFunction] Function '${functionName}' did not return an array`)
            return []
        }

        // Validate each option has value and label
        const validOptions = result.filter(opt => {
            if (!opt || typeof opt !== 'object') return false
            if (!('value' in opt)) return false
            return true
        })

        return validOptions

    } catch (error) {
        console.error(`[executeOptionsFunction] Error executing '${functionName}':`, error)
        return []
    }
}

/**
 * Check if a function exists in the registry
 * 
 * @param {string} functionName - Name of the function
 * @returns {boolean} True if function exists
 */
export function hasOptionsFunction(functionName) {
    return functionName && functionName in OPTIONS_FUNCTIONS
}

