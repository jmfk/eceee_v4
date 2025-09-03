/**
 * Change Detection Utilities
 * 
 * Comprehensive tools for detecting changes in editor data
 */

import { analyzeChanges } from './smartSaveUtils'

/**
 * Check if any data has changed in the editor
 * @param {Object} currentState - Current editor state
 * @param {Object} originalState - Original loaded state  
 * @returns {Object} Detailed change information
 */
export function detectEditorChanges(currentState, originalState) {
    const result = {
        hasChanges: false,
        hasPageChanges: false,
        hasVersionChanges: false,
        hasWidgetChanges: false,
        hasFormDataChanges: false,
        changes: {},
        summary: '',
        changedFields: [],
        timestamp: new Date().toISOString()
    }

    // Use smart save utils for detailed analysis
    const changes = analyzeChanges(
        originalState?.webpageData || {},
        currentState?.webpageData || {},
        originalState?.pageVersionData || {},
        currentState?.pageVersionData || {}
    )

    result.hasPageChanges = changes.hasPageChanges
    result.hasVersionChanges = changes.hasVersionChanges
    result.hasChanges = changes.hasPageChanges || changes.hasVersionChanges
    result.changes = changes
    result.changedFields = changes.changedFieldNames

    // Check specific types of changes
    if (changes.versionFields.widgets) {
        result.hasWidgetChanges = true
    }

    if (changes.versionFields.pageData) {
        result.hasFormDataChanges = true
    }

    // Generate human-readable summary
    const summaryParts = []
    if (result.hasPageChanges) {
        const pageFields = Object.keys(changes.pageFields)
        summaryParts.push(`Page: ${pageFields.join(', ')}`)
    }
    if (result.hasVersionChanges) {
        const versionFields = Object.keys(changes.versionFields)
        summaryParts.push(`Content: ${versionFields.join(', ')}`)
    }

    result.summary = summaryParts.join(' | ') || 'No changes detected'

    return result
}

/**
 * Quick check if editor has any unsaved changes
 * @param {Object} currentState - Current editor state
 * @param {Object} originalState - Original loaded state
 * @returns {boolean} True if there are unsaved changes
 */
export function hasUnsavedChanges(currentState, originalState) {
    return detectEditorChanges(currentState, originalState).hasChanges
}

/**
 * Check if specific field has changed
 * @param {string} fieldName - Name of field to check
 * @param {Object} currentState - Current editor state
 * @param {Object} originalState - Original loaded state
 * @returns {boolean} True if field has changed
 */
export function hasFieldChanged(fieldName, currentState, originalState) {
    const changes = detectEditorChanges(currentState, originalState)
    return changes.changedFields.includes(fieldName)
}

/**
 * Get detailed diff of what changed
 * @param {Object} currentState - Current editor state
 * @param {Object} originalState - Original loaded state
 * @returns {Object} Detailed diff information
 */
export function getChangesDiff(currentState, originalState) {
    const changes = detectEditorChanges(currentState, originalState)

    const diff = {
        added: {},
        modified: {},
        removed: {},
        unchanged: {}
    }

    // Compare page fields
    const currentPage = currentState?.webpageData || {}
    const originalPage = originalState?.webpageData || {}

    const allPageFields = new Set([
        ...Object.keys(currentPage),
        ...Object.keys(originalPage)
    ])

    allPageFields.forEach(field => {
        const currentValue = currentPage[field]
        const originalValue = originalPage[field]

        if (originalValue === undefined && currentValue !== undefined) {
            diff.added[`page.${field}`] = currentValue
        } else if (originalValue !== undefined && currentValue === undefined) {
            diff.removed[`page.${field}`] = originalValue
        } else if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
            diff.modified[`page.${field}`] = {
                from: originalValue,
                to: currentValue
            }
        } else {
            diff.unchanged[`page.${field}`] = currentValue
        }
    })

    // Compare version fields
    const currentVersion = currentState?.pageVersionData || {}
    const originalVersion = originalState?.pageVersionData || {}

    const allVersionFields = new Set([
        ...Object.keys(currentVersion),
        ...Object.keys(originalVersion)
    ])

    allVersionFields.forEach(field => {
        const currentValue = currentVersion[field]
        const originalValue = originalVersion[field]

        if (originalValue === undefined && currentValue !== undefined) {
            diff.added[`version.${field}`] = currentValue
        } else if (originalValue !== undefined && currentValue === undefined) {
            diff.removed[`version.${field}`] = originalValue
        } else if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
            diff.modified[`version.${field}`] = {
                from: originalValue,
                to: currentValue
            }
        } else {
            diff.unchanged[`version.${field}`] = currentValue
        }
    })

    return diff
}

/**
 * Check changes against server-loaded data
 * @param {Object} currentState - Current editor state
 * @param {Object} serverData - Data loaded from server
 * @returns {Object} Comparison with server data
 */
export function compareWithServerData(currentState, serverData) {
    const result = {
        hasConflicts: false,
        conflicts: [],
        localChanges: [],
        serverChanges: [],
        canMerge: true,
        timestamp: new Date().toISOString()
    }

    // This would be used when server loading overwrites local changes
    // Compare current validated state with incoming server data
    const currentPage = currentState?.pageVersionData || {}
    const serverPage = serverData || {}

    Object.keys(currentPage).forEach(field => {
        const localValue = currentPage[field]
        const serverValue = serverPage[field]

        if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
            if (localValue !== undefined && serverValue !== undefined) {
                // Both have values but they differ - conflict!
                result.conflicts.push({
                    field,
                    localValue,
                    serverValue,
                    canAutoResolve: false
                })
                result.hasConflicts = true
            } else if (localValue !== undefined) {
                result.localChanges.push({ field, value: localValue })
            } else if (serverValue !== undefined) {
                result.serverChanges.push({ field, value: serverValue })
            }
        }
    })

    result.canMerge = !result.hasConflicts

    return result
}

/**
 * Console logging helper for change detection
 * @param {Object} currentState - Current editor state
 * @param {Object} originalState - Original loaded state
 * @param {string} context - Context for the log
 */
export function logChanges(currentState, originalState, context = 'Editor') {
    const changes = detectEditorChanges(currentState, originalState)

    // Debug information available in changes object
    if (changes.hasChanges && window.DEBUG_MODE) {
        console.group(`🔍 ${context} Change Detection`)
        console.log('Has changes:', changes.hasChanges)
        console.log('Summary:', changes.summary)
        console.log('Changed fields:', changes.changedFields)
        console.log('Detailed changes:', changes.changes)

        if (changes.hasPageChanges) {
            console.log('📄 Page changes:', changes.changes.pageFields)
        }

        if (changes.hasVersionChanges) {
            console.log('📝 Version changes:', changes.changes.versionFields)
        }

        console.groupEnd()
    }

    return changes
}
