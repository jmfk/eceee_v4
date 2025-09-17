/**
 * Media Tag Utilities
 * 
 * Utilities for validating, creating, and managing media tags in property configurations.
 */

import { mediaApi } from '../api'

/**
 * Parse a comma-separated string of tag names into an array
 * @param {string} tagString - Comma-separated tag names
 * @returns {string[]} Array of trimmed tag names
 */
export const parseTagString = (tagString) => {
    if (!tagString || typeof tagString !== 'string') {
        return []
    }

    return tagString
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
}

/**
 * Validate and potentially create media tags
 * @param {string[]} tagNames - Array of tag names to validate/create
 * @param {string} namespace - Namespace slug (defaults to 'default')
 * @returns {Promise<{validTags: Array, createdTags: Array, errors: Array}>}
 */
export const validateAndCreateTags = async (tagNames, namespace = 'default') => {
    const validTags = []
    const createdTags = []
    const errors = []

    if (!Array.isArray(tagNames) || tagNames.length === 0) {
        return { validTags, createdTags, errors }
    }

    try {
        // First, try to get existing tags
        const existingTagsResponse = await mediaApi.tags.list({
            namespace,
            page_size: 1000 // Get a large batch to check against
        })()

        const existingTags = existingTagsResponse.results || existingTagsResponse || []
        const existingTagNames = new Set(
            existingTags.map(tag => tag.name.toLowerCase())
        )

        // Process each tag name
        for (const tagName of tagNames) {
            const trimmedName = tagName.trim()

            if (!trimmedName) {
                continue
            }

            // Validate tag name format
            if (trimmedName.length > 50) {
                errors.push(`Tag name "${trimmedName}" is too long (max 50 characters)`)
                continue
            }

            if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
                errors.push(`Tag name "${trimmedName}" contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores.`)
                continue
            }

            // Check if tag already exists (case-insensitive)
            if (existingTagNames.has(trimmedName.toLowerCase())) {
                const existingTag = existingTags.find(
                    tag => tag.name.toLowerCase() === trimmedName.toLowerCase()
                )
                validTags.push(existingTag)
                continue
            }

            // Tag doesn't exist, try to create it
            try {
                const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                const newTag = await mediaApi.tags.create({
                    name: trimmedName,
                    slug: slug,
                    namespace,
                    description: `Auto-created tag for property configuration`,
                    color: '#3B82F6' // Default blue color
                })()

                createdTags.push(newTag)
                validTags.push(newTag)
            } catch (createError) {
                console.error('Failed to create tag:', createError)
                errors.push(`Failed to create tag "${trimmedName}": ${createError.message || 'Unknown error'}`)
            }
        }
    } catch (error) {
        console.error('Failed to validate tags:', error)
        errors.push(`Failed to validate tags: ${error.message || 'Unknown error'}`)
    }

    return { validTags, createdTags, errors }
}

/**
 * Format tags for display in the UI
 * @param {Array} tags - Array of tag objects or names
 * @returns {string} Comma-separated tag names
 */
export const formatTagsForDisplay = (tags) => {
    if (!Array.isArray(tags)) {
        return ''
    }

    return tags
        .map(tag => typeof tag === 'string' ? tag : tag.name)
        .join(', ')
}

/**
 * Get tag suggestions based on a search query
 * @param {string} query - Search query
 * @param {string} namespace - Namespace slug
 * @returns {Promise<Array>} Array of matching tags
 */
export const getTagSuggestions = async (query, namespace = 'default') => {
    if (!query || query.trim().length < 2) {
        return []
    }

    try {
        const response = await mediaApi.tags.list({
            namespace,
            search: query.trim(),
            page_size: 10
        })()

        return response.results || response || []
    } catch (error) {
        console.error('Failed to get tag suggestions:', error)
        return []
    }
}

/**
 * Validate a single tag name
 * @param {string} tagName - Tag name to validate
 * @returns {Object} Validation result with isValid and error message
 */
export const validateTagName = (tagName) => {
    if (!tagName || typeof tagName !== 'string') {
        return { isValid: false, error: 'Tag name is required' }
    }

    const trimmed = tagName.trim()

    if (trimmed.length === 0) {
        return { isValid: false, error: 'Tag name cannot be empty' }
    }

    if (trimmed.length > 50) {
        return { isValid: false, error: 'Tag name is too long (max 50 characters)' }
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
        return { isValid: false, error: 'Tag name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores.' }
    }

    return { isValid: true, error: null }
}
