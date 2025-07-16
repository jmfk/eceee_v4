import axios from 'axios'

const API_BASE = '/api/v1/webpages'

/**
 * Version Management API
 * Provides functions for managing page versions with draft/published workflow
 */

// Create a new version
export const createVersion = async (pageId, versionData) => {
    const response = await axios.post(`${API_BASE}/versions/`, {
        page: pageId,
        ...versionData
    })
    return response.data
}

// Get all versions for a page
export const getPageVersions = async (pageId, filters = {}) => {
    const params = new URLSearchParams({ page: pageId, ...filters })
    const response = await axios.get(`${API_BASE}/versions/?${params}`)
    return response.data
}

// Get a specific version
export const getVersion = async (versionId) => {
    const response = await axios.get(`${API_BASE}/versions/${versionId}/`)
    return response.data
}

// Update a version (only drafts can be updated)
export const updateVersion = async (versionId, versionData) => {
    const response = await axios.patch(`${API_BASE}/versions/${versionId}/`, versionData)
    return response.data
}

// Delete a version (only drafts can be deleted)
export const deleteVersion = async (versionId) => {
    await axios.delete(`${API_BASE}/versions/${versionId}/`)
}

// Publish a version
export const publishVersion = async (versionId) => {
    const response = await axios.post(`${API_BASE}/versions/${versionId}/publish/`)
    return response.data
}

// Create a draft from a published version
export const createDraftFromPublished = async (versionId, description = '') => {
    const response = await axios.post(`${API_BASE}/versions/${versionId}/create_draft/`, {
        description
    })
    return response.data
}

// Restore a version as current
export const restoreVersion = async (versionId) => {
    const response = await axios.post(`${API_BASE}/versions/${versionId}/restore/`)
    return response.data
}

// Compare two versions
export const compareVersions = async (version1Id, version2Id) => {
    const response = await axios.get(`${API_BASE}/versions/compare/?version1=${version1Id}&version2=${version2Id}`)
    return response.data
}

// Get filtered versions
export const getVersionsFiltered = async (filters = {}) => {
    const params = new URLSearchParams(filters)
    const response = await axios.get(`${API_BASE}/versions/?${params}`)
    return response.data
}

// Get current version for a page
export const getCurrentVersion = async (pageId) => {
    const response = await axios.get(`${API_BASE}/versions/?page=${pageId}&is_current=true`)
    return response.data.results[0] || null
}

// Get latest draft for a page
export const getLatestDraft = async (pageId) => {
    const response = await axios.get(`${API_BASE}/versions/?page=${pageId}&status=draft&ordering=-version_number`)
    return response.data.results[0] || null
}

// Get version statistics for a page
export const getVersionStats = async (pageId) => {
    const [drafts, published, current] = await Promise.all([
        axios.get(`${API_BASE}/versions/?page=${pageId}&status=draft`),
        axios.get(`${API_BASE}/versions/?page=${pageId}&status=published`),
        axios.get(`${API_BASE}/versions/?page=${pageId}&is_current=true`)
    ])

    return {
        total_drafts: drafts.data.count || 0,
        total_published: published.data.count || 0,
        has_current: current.data.count > 0,
        current_version: current.data.results[0] || null
    }
}

// Batch operations
export const batchPublishDrafts = async (versionIds) => {
    const results = await Promise.allSettled(
        versionIds.map(id => publishVersion(id))
    )
    return results
}

export const batchDeleteDrafts = async (versionIds) => {
    const results = await Promise.allSettled(
        versionIds.map(id => deleteVersion(id))
    )
    return results
}

// Version workflow helpers
export const canEditVersion = (version) => {
    return version.status === 'draft'
}

export const canPublishVersion = (version) => {
    return version.status === 'draft'
}

export const canDeleteVersion = (version) => {
    return version.status === 'draft' && !version.is_current
}

export const canCreateDraft = (version) => {
    return version.status === 'published'
}

// Format version for display
export const formatVersionForDisplay = (version) => {
    return {
        ...version,
        displayName: `v${version.version_number} - ${version.status}`,
        formattedDate: new Date(version.created_at).toLocaleDateString(),
        formattedPublishDate: version.published_at ? new Date(version.published_at).toLocaleDateString() : null,
        statusBadge: {
            draft: { color: 'yellow', text: 'Draft' },
            published: { color: 'green', text: 'Published' },
            archived: { color: 'gray', text: 'Archived' }
        }[version.status] || { color: 'gray', text: version.status }
    }
} 