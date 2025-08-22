/**
 * State Verification Utilities
 * 
 * Provides tools to verify consistency between different state sources
 * and debug validation-driven data sync
 */

/**
 * Verify state consistency between canonical and temporary states
 */
export const verifyStateConsistency = (canonicalState, tempStates = {}) => {
    const issues = []
    const warnings = []

    // Check page data consistency
    if (tempStates.pageData && canonicalState.pageVersionData?.pageData) {
        const canonical = canonicalState.pageVersionData.pageData
        const temp = tempStates.pageData

        Object.keys(temp).forEach(key => {
            if (JSON.stringify(canonical[key]) !== JSON.stringify(temp[key])) {
                issues.push({
                    type: 'pageData',
                    field: key,
                    canonical: canonical[key],
                    temp: temp[key],
                    message: `Page data field '${key}' differs between canonical and temp state`
                })
            }
        })
    }

    // Check widget data consistency
    if (tempStates.widgets && canonicalState.pageVersionData?.widgets) {
        const canonical = canonicalState.pageVersionData.widgets
        const temp = tempStates.widgets

        Object.keys(temp).forEach(slotName => {
            const canonicalSlot = canonical[slotName] || []
            const tempSlot = temp[slotName] || []

            if (JSON.stringify(canonicalSlot) !== JSON.stringify(tempSlot)) {
                issues.push({
                    type: 'widget',
                    slot: slotName,
                    canonical: canonicalSlot,
                    temp: tempSlot,
                    message: `Widget slot '${slotName}' differs between canonical and temp state`
                })
            }
        })
    }

    return {
        isConsistent: issues.length === 0,
        issues,
        warnings,
        summary: {
            totalIssues: issues.length,
            totalWarnings: warnings.length,
            timestamp: new Date().toISOString()
        }
    }
}

/**
 * Log validation-driven sync operations for debugging
 */
export const logValidationSync = (type, data, source = 'unknown') => {
    const timestamp = new Date().toISOString()
    const logEntry = {
        timestamp,
        type, // 'pageData' | 'widget' | 'validation'
        source,
        data,
        stackTrace: new Error().stack
    }

    // console.group(`🔄 Validation Sync: ${type}`)
    // console.log('Source:', source)
    // console.log('Data:', data)
    // console.log('Timestamp:', timestamp)
    // console.groupEnd()

    // Store in sessionStorage for debugging
    try {
        const existing = JSON.parse(sessionStorage.getItem('validationSyncLog') || '[]')
        existing.push(logEntry)

        // Keep only last 50 entries
        if (existing.length > 50) {
            existing.splice(0, existing.length - 50)
        }

        sessionStorage.setItem('validationSyncLog', JSON.stringify(existing))
    } catch (error) {
        console.warn('Failed to store validation sync log:', error)
    }

    return logEntry
}

/**
 * Get validation sync audit trail
 */
export const getValidationSyncLog = () => {
    try {
        return JSON.parse(sessionStorage.getItem('validationSyncLog') || '[]')
    } catch (error) {
        console.warn('Failed to retrieve validation sync log:', error)
        return []
    }
}

/**
 * Clear validation sync audit trail
 */
export const clearValidationSyncLog = () => {
    try {
        sessionStorage.removeItem('validationSyncLog')
    } catch (error) {
        console.warn('Failed to clear validation sync log:', error)
    }
}

/**
 * Debug helper: Compare current state with expected state
 */
export const debugStateComparison = (currentState, expectedState, context = 'unknown') => {
    console.group(`🔍 State Debug: ${context}`)
    console.log('Current State:', currentState)
    console.log('Expected State:', expectedState)

    const differences = []

    // Simple deep comparison
    const compare = (current, expected, path = '') => {
        if (typeof current !== typeof expected) {
            differences.push({
                path,
                current: typeof current,
                expected: typeof expected,
                message: `Type mismatch at ${path}`
            })
            return
        }

        if (current === null || expected === null) {
            if (current !== expected) {
                differences.push({
                    path,
                    current,
                    expected,
                    message: `Null value mismatch at ${path}`
                })
            }
            return
        }

        if (typeof current === 'object') {
            const currentKeys = Object.keys(current)
            const expectedKeys = Object.keys(expected)

            const allKeys = [...new Set([...currentKeys, ...expectedKeys])]

            allKeys.forEach(key => {
                const newPath = path ? `${path}.${key}` : key
                if (!(key in current)) {
                    differences.push({
                        path: newPath,
                        current: undefined,
                        expected: expected[key],
                        message: `Missing key in current: ${newPath}`
                    })
                } else if (!(key in expected)) {
                    differences.push({
                        path: newPath,
                        current: current[key],
                        expected: undefined,
                        message: `Extra key in current: ${newPath}`
                    })
                } else {
                    compare(current[key], expected[key], newPath)
                }
            })
        } else {
            if (current !== expected) {
                differences.push({
                    path,
                    current,
                    expected,
                    message: `Value mismatch at ${path}`
                })
            }
        }
    }

    compare(currentState, expectedState)

    if (differences.length > 0) {
        console.warn('Differences found:', differences)
    } else {
        console.log('✅ States match perfectly')
    }

    console.groupEnd()

    return {
        matches: differences.length === 0,
        differences,
        context
    }
}
