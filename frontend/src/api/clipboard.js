/**
 * Clipboard API Service
 * 
 * Functions for interacting with the server-side clipboard API.
 */

import apiClient from './client'
import { endpoints } from './endpoints'
import toast from 'react-hot-toast'

/**
 * Create a new clipboard entry
 * @param {string} type - Clipboard type (widgets, pages, content, media)
 * @param {Object|Array} data - Clipboard content data
 * @param {string} operation - Operation type ('cut' or 'copy')
 * @param {Object} metadata - Optional metadata (pageId, widgetPaths, etc.)
 * @param {Date} expiresAt - Optional expiration date
 * @returns {Promise<string>} UUID of the created clipboard entry
 */
export const createClipboardEntry = async (type, data, operation, metadata = {}, expiresAt = null) => {
    try {
        const payload = {
            clipboardType: type,
            operation: operation,
            data: data,
            metadata: metadata,
        }
        
        if (expiresAt) {
            payload.expiresAt = expiresAt.toISOString()
        }

        const response = await apiClient.post(endpoints.clipboard.create, payload)
        
        // Save UUID to localStorage
        const storageKey = `clipboard_${type}_uuid`
        localStorage.setItem(storageKey, response.data.id)
        
        return response.data.id
    } catch (error) {
        console.error('Failed to create clipboard entry:', error)
        toast.error('Failed to save to clipboard')
        throw error
    }
}

/**
 * Get clipboard entry by UUID
 * @param {string} uuid - Clipboard entry UUID
 * @returns {Promise<Object>} Clipboard entry data
 */
export const getClipboardEntry = async (uuid) => {
    try {
        const response = await apiClient.get(endpoints.clipboard.get(uuid))
        return response.data
    } catch (error) {
        console.error('Failed to get clipboard entry:', error)
        if (error.response?.status === 404) {
            toast.error('Clipboard entry not found')
        } else {
            toast.error('Failed to read from clipboard')
        }
        throw error
    }
}

/**
 * Get clipboard entry by type (most recent for that type)
 * @param {string} type - Clipboard type
 * @returns {Promise<Object|null>} Clipboard entry data or null if not found
 */
export const getClipboardByType = async (type) => {
    try {
        const response = await apiClient.get(endpoints.clipboard.getByType(type))
        return response.data
    } catch (error) {
        if (error.response?.status === 404) {
            // No clipboard entry for this type - this is normal
            return null
        }
        console.error('Failed to get clipboard by type:', error)
        toast.error('Failed to read from clipboard')
        throw error
    }
}

/**
 * Delete clipboard entry by UUID
 * @param {string} uuid - Clipboard entry UUID
 * @returns {Promise<void>}
 */
export const deleteClipboardEntry = async (uuid) => {
    try {
        await apiClient.delete(endpoints.clipboard.delete(uuid))
    } catch (error) {
        console.error('Failed to delete clipboard entry:', error)
        // Don't show toast for delete errors - it's not critical
    }
}

/**
 * Clear all clipboard entries of a specific type
 * @param {string} type - Clipboard type
 * @returns {Promise<void>}
 */
export const clearClipboardByType = async (type) => {
    try {
        await apiClient.delete(endpoints.clipboard.clearByType(type))
        // Remove UUID from localStorage
        const storageKey = `clipboard_${type}_uuid`
        localStorage.removeItem(storageKey)
    } catch (error) {
        console.error('Failed to clear clipboard by type:', error)
        toast.error('Failed to clear clipboard')
        throw error
    }
}

/**
 * Clear all clipboard entries for the current user
 * @returns {Promise<void>}
 */
export const clearAllClipboards = async () => {
    try {
        await apiClient.delete(endpoints.clipboard.clearAll())
        // Clear all clipboard UUIDs from localStorage
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
            if (key.startsWith('clipboard_') && key.endsWith('_uuid')) {
                localStorage.removeItem(key)
            }
        })
    } catch (error) {
        console.error('Failed to clear all clipboards:', error)
        toast.error('Failed to clear clipboard')
        throw error
    }
}

/**
 * Get UUID from localStorage for a clipboard type
 * @param {string} type - Clipboard type
 * @returns {string|null} UUID or null if not found
 */
export const getClipboardUuid = (type) => {
    const storageKey = `clipboard_${type}_uuid`
    return localStorage.getItem(storageKey)
}

/**
 * Set UUID in localStorage for a clipboard type
 * @param {string} type - Clipboard type
 * @param {string} uuid - UUID to store
 */
export const setClipboardUuid = (type, uuid) => {
    const storageKey = `clipboard_${type}_uuid`
    localStorage.setItem(storageKey, uuid)
}

/**
 * Remove UUID from localStorage for a clipboard type
 * @param {string} type - Clipboard type
 */
export const removeClipboardUuid = (type) => {
    const storageKey = `clipboard_${type}_uuid`
    localStorage.removeItem(storageKey)
}

