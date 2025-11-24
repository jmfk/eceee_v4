/**
 * General-Purpose Clipboard Service
 * 
 * Replaces browser Clipboard API with server-side clipboard storage.
 * Supports multiple clipboard types (widgets, pages, content, media, etc.)
 * and works across browser windows/instances.
 */

import {
    createClipboardEntry,
    getClipboardEntry,
    getClipboardByType,
    deleteClipboardEntry,
    clearClipboardByType,
    clearAllClipboards,
    getClipboardUuid,
    setClipboardUuid,
    removeClipboardUuid,
} from '../api/clipboard'
import toast from 'react-hot-toast'

/**
 * Copy data to clipboard
 * @param {string} type - Clipboard type (widgets, pages, content, media)
 * @param {Object|Array} data - Data to copy
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (type, data, metadata = {}) => {
    try {
        if (!data) {
            toast.error(`No data to copy`)
            return false
        }

        // Clear any existing clipboard entry of this type
        // Silently ignore errors (401, 404, etc.) - might not exist or user might not be authenticated
        try {
            await clearClipboardByType(type)
        } catch (error) {
            // Ignore all errors - clipboard clearing is optional
            console.debug('Could not clear existing clipboard entry:', error)
        }

        // Create new clipboard entry
        const uuid = await createClipboardEntry(type, data, 'copy', metadata)
        
        // Don't show toast - clipboard indicator shows the state
        return true
    } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        return false
    }
}

/**
 * Cut data to clipboard (marks for deletion after paste)
 * @param {string} type - Clipboard type
 * @param {Object|Array} data - Data to cut
 * @param {Object} metadata - Metadata including source information (pageId, widgetPaths, etc.)
 * @returns {Promise<boolean>} Success status
 */
export const cutToClipboard = async (type, data, metadata = {}) => {
    try {
        if (!data) {
            toast.error(`No data to cut`)
            return false
        }

        // Clear any existing clipboard entry of this type
        // Silently ignore errors (401, 404, etc.) - might not exist or user might not be authenticated
        try {
            await clearClipboardByType(type)
        } catch (error) {
            // Ignore all errors - clipboard clearing is optional
            console.debug('Could not clear existing clipboard entry:', error)
        }

        // Create new clipboard entry with cut operation
        const uuid = await createClipboardEntry(type, data, 'cut', metadata)
        
        // Don't show toast - clipboard indicator shows the state
        return true
    } catch (error) {
        console.error('Failed to cut to clipboard:', error)
        return false
    }
}

/**
 * Read clipboard data for a specific type
 * @param {string} type - Clipboard type
 * @param {boolean} silent - If true, don't show error toasts (for polling)
 * @returns {Promise<Object|null>} Clipboard data with operation and metadata, or null if not found
 */
export const readFromClipboard = async (type, silent = false) => {
    try {
        // First try to get by type (most recent)
        let entry = await getClipboardByType(type)
        
        // If not found, try to get by stored UUID
        if (!entry) {
            const uuid = getClipboardUuid(type)
            if (uuid) {
                try {
                    entry = await getClipboardEntry(uuid)
                } catch (error) {
                    // UUID might be stale, remove it
                    removeClipboardUuid(type)
                }
            }
        }

        if (!entry) {
            // Don't show toast for silent operations (polling)
            return null
        }

        // Check if expired
        if (entry.expiresAt) {
            const expiresAt = new Date(entry.expiresAt)
            if (new Date() > expiresAt) {
                // Entry expired, delete it
                if (entry.id) {
                    await deleteClipboardEntry(entry.id).catch(() => {})
                }
                removeClipboardUuid(type)
                if (!silent) {
                    toast.error('Clipboard entry has expired')
                }
                return null
            }
        }

        // Normalize data to array for backward compatibility
        const data = Array.isArray(entry.data) ? entry.data : [entry.data]
        
        return {
            data: data,
            isArray: Array.isArray(entry.data),
            operation: entry.operation,
            metadata: entry.metadata || {},
            id: entry.id,
        }
    } catch (error) {
        console.error('Failed to read from clipboard:', error)
        return null
    }
}

/**
 * Get clipboard operation type (cut or copy)
 * @param {string} type - Clipboard type
 * @returns {Promise<string|null>} Operation type ('cut', 'copy') or null
 */
export const getClipboardOperationType = async (type) => {
    try {
        const result = await readFromClipboard(type)
        return result ? result.operation : null
    } catch (error) {
        return null
    }
}

/**
 * Clear clipboard for a specific type
 * @param {string} type - Clipboard type
 * @returns {Promise<boolean>} Success status
 */
export const clearClipboard = async (type) => {
    try {
        await clearClipboardByType(type)
        return true
    } catch (error) {
        console.error('Failed to clear clipboard:', error)
        return false
    }
}

/**
 * Clear all clipboards
 * @returns {Promise<boolean>} Success status
 */
export const clearAllClipboardsService = async () => {
    try {
        await clearAllClipboards()
        return true
    } catch (error) {
        console.error('Failed to clear all clipboards:', error)
        return false
    }
}

// Backward compatibility helpers for widget clipboard
// These maintain the same API as the old widgetClipboard.js

/**
 * Copy widgets to clipboard (backward compatibility)
 * @param {Array} widgets - Widgets to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyWidgetsToClipboard = async (widgets) => {
    return await copyToClipboard('widgets', widgets)
}

/**
 * Cut widgets to clipboard (backward compatibility)
 * @param {Array} widgets - Widgets to cut
 * @param {Object} cutMetadata - Cut metadata (pageId, widgetPaths, etc.)
 * @returns {Promise<boolean>} Success status
 */
export const cutWidgetsToClipboard = async (widgets, cutMetadata = {}) => {
    return await cutToClipboard('widgets', widgets, cutMetadata)
}

/**
 * Read widgets from clipboard (backward compatibility)
 * @returns {Promise<Object|null>} Clipboard data with widgets, operation, and metadata
 */
export const readWidgetsFromClipboard = async () => {
    return await readFromClipboard('widgets')
}

/**
 * Read clipboard with metadata (backward compatibility)
 * @returns {Promise<Object|null>} Clipboard data
 */
export const readClipboardWithMetadata = async () => {
    return await readFromClipboard('widgets')
}

/**
 * Get clipboard operation type for widgets (backward compatibility)
 * @returns {Promise<string|null>} Operation type
 */
export const getWidgetClipboardOperationType = async () => {
    return await getClipboardOperationType('widgets')
}

