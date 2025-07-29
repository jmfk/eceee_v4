import { api } from './client.js'

const API_BASE = '/api/v1/webpages'

/**
 * Version Management API
 * Provides functions for managing page versions with draft/published workflow
 */

// Create a new version
export const createVersion = async (pageId, versionData) => {
    const response = await api.post(`${API_BASE}/versions/`, {
        page: pageId,
        ...versionData
    })
    return response.data
}

// Get all versions for a page
export const getPageVersions = async (pageId, filters = {}) => {
    const params = new URLSearchParams({ page__id: pageId, ...filters })
    const response = await api.get(`${API_BASE}/versions/?${params}`)
    return response.data
}

// Get a specific version
export const getVersion = async (versionId) => {
    const response = await api.get(`${API_BASE}/versions/${versionId}/`)
    return response.data
}

// Update a version (only drafts can be updated)
export const updateVersion = async (versionId, versionData) => {
    const response = await api.patch(`${API_BASE}/versions/${versionId}/`, versionData)
    return response.data
}

// Delete a version (only drafts can be deleted)
export const deleteVersion = async (versionId) => {
    await api.delete(`${API_BASE}/versions/${versionId}/`)
}

// Publish a version
export const publishVersion = async (versionId) => {
    const response = await api.post(`${API_BASE}/versions/${versionId}/publish/`)
    return response.data
}

// Get widget data for a specific version
export const getVersionWidgets = async (versionId) => {
    const response = await api.get(`${API_BASE}/versions/${versionId}/widgets/`)
    return response.data
}

// Get complete data for a specific version of a page (NEW ENDPOINT)
export const getPageVersion = async (pageId, versionId) => {
    const response = await api.get(`${API_BASE}/pages/${pageId}/versions/${versionId}/`)
    return response.data
}

// Get all versions for a page
export const getPageVersionsList = async (pageId) => {
    const response = await api.get(`${API_BASE}/pages/${pageId}/versions/`)
    return response.data
}

// Create a draft from a published version
export const createDraftFromPublished = async (versionId, description = '') => {
    const response = await api.post(`${API_BASE}/versions/${versionId}/create_draft/`, {
        description
    })
    return response.data
}

// Restore a version as current
export const restoreVersion = async (versionId) => {
    const response = await api.post(`${API_BASE}/versions/${versionId}/restore/`)
    return response.data
}

// Compare two versions
export const compareVersions = async (version1Id, version2Id) => {
    const response = await api.get(`${API_BASE}/versions/compare/?version1=${version1Id}&version2=${version2Id}`)
    return response.data
}

// Get filtered versions
export const getVersionsFiltered = async (filters = {}) => {
    const params = new URLSearchParams(filters)
    const response = await api.get(`${API_BASE}/versions/?${params}`)
    return response.data
}

// Get current version for a page
export const getCurrentVersion = async (pageId) => {
    const response = await api.get(`${API_BASE}/versions/?page__id=${pageId}&is_current=true`)
    return response.data.results[0] || null
}

// Get latest draft for a page
export const getLatestDraft = async (pageId) => {
    const response = await api.get(`${API_BASE}/versions/?page__id=${pageId}&status=draft&ordering=-version_number`)
    return response.data.results[0] || null
}

// Get version statistics for a page
export const getVersionStats = async (pageId) => {
    const [drafts, published, current] = await Promise.all([
        api.get(`${API_BASE}/versions/?page__id=${pageId}&status=draft`),
        api.get(`${API_BASE}/versions/?page__id=${pageId}&status=published`),
        api.get(`${API_BASE}/versions/?page__id=${pageId}&is_current=true`)
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

/**
 * Widget Management API
 * Functions for managing widgets as JSON data within PageVersion
 */

// Get widgets for a page (from current version)
export const getPageWidgets = async (pageId) => {
    const currentVersion = await getCurrentVersion(pageId)
    if (!currentVersion) {
        return { widgets: [], version: null }
    }

    return {
        widgets: currentVersion.widgets || [],
        version: currentVersion
    }
}

// Add a widget to a page (creates new version)
export const addWidget = async (pageId, widgetData, description = 'Added widget') => {
    // Get current version or latest draft
    let version = await getLatestDraft(pageId)
    if (!version) {
        version = await getCurrentVersion(pageId)
        if (version) {
            // Create a draft from published version
            version = await createDraftFromPublished(version.id, 'Draft for widget changes')
        } else {
            throw new Error('No version found for page')
        }
    }

    // Add widget to version's widgets array
    const currentWidgets = version.widgets || []
    const newWidget = {
        ...widgetData,
        id: Date.now(), // Temporary ID for frontend
        created_at: new Date().toISOString()
    }

    const updatedWidgets = [...currentWidgets, newWidget]

    // Update the version
    const updatedVersion = await updateVersion(version.id, {
        widgets: updatedWidgets,
        description: description
    })

    return {
        widget: newWidget,
        version: updatedVersion
    }
}

// Update a widget in a page (modifies existing version)
export const updateWidget = async (pageId, widgetId, widgetData, description = 'Updated widget') => {
    // Get latest draft
    let version = await getLatestDraft(pageId)
    if (!version) {
        version = await getCurrentVersion(pageId)
        if (version) {
            // Create a draft from published version
            version = await createDraftFromPublished(version.id, 'Draft for widget changes')
        } else {
            throw new Error('No version found for page')
        }
    }

    // Update widget in widgets array
    const currentWidgets = version.widgets || []
    const updatedWidgets = currentWidgets.map(widget =>
        widget.id === widgetId ? { ...widget, ...widgetData } : widget
    )

    // Update the version
    const updatedVersion = await updateVersion(version.id, {
        widgets: updatedWidgets,
        description: description
    })

    const updatedWidget = updatedWidgets.find(w => w.id === widgetId)
    return {
        widget: updatedWidget,
        version: updatedVersion
    }
}

// Delete a widget from a page
export const deleteWidget = async (pageId, widgetId, description = 'Deleted widget') => {
    // Get latest draft
    let version = await getLatestDraft(pageId)
    if (!version) {
        version = await getCurrentVersion(pageId)
        if (version) {
            // Create a draft from published version
            version = await createDraftFromPublished(version.id, 'Draft for widget changes')
        } else {
            throw new Error('No version found for page')
        }
    }

    // Remove widget from widgets array
    const currentWidgets = version.widgets || []
    const updatedWidgets = currentWidgets.filter(widget => widget.id !== widgetId)

    // Update the version
    const updatedVersion = await updateVersion(version.id, {
        widgets: updatedWidgets,
        description: description
    })

    return {
        version: updatedVersion
    }
}

// Reorder widgets in a slot
export const reorderWidgets = async (pageId, slotName, widgetOrders, description = 'Reordered widgets') => {
    // Get latest draft
    let version = await getLatestDraft(pageId)
    if (!version) {
        version = await getCurrentVersion(pageId)
        if (version) {
            // Create a draft from published version
            version = await createDraftFromPublished(version.id, 'Draft for widget changes')
        } else {
            throw new Error('No version found for page')
        }
    }

    // Update sort orders for widgets in the slot
    const currentWidgets = version.widgets || []
    const updatedWidgets = currentWidgets.map(widget => {
        if (widget.slot_name === slotName) {
            const orderData = widgetOrders.find(order => order.widget_id === widget.id)
            if (orderData) {
                return {
                    ...widget,
                    sort_order: orderData.sort_order,
                    priority: orderData.priority || widget.priority || 0
                }
            }
        }
        return widget
    })

    // Update the version
    const updatedVersion = await updateVersion(version.id, {
        widgets: updatedWidgets,
        description: description
    })

    return {
        version: updatedVersion
    }
}

// Get widgets organized by slot
export const getWidgetsBySlot = async (pageId) => {
    const { widgets } = await getPageWidgets(pageId)

    const widgetsBySlot = {}
    widgets.forEach(widget => {
        const slotName = widget.slot_name || 'default'
        if (!widgetsBySlot[slotName]) {
            widgetsBySlot[slotName] = []
        }
        widgetsBySlot[slotName].push(widget)
    })

    // Sort widgets within each slot by priority and sort_order
    Object.keys(widgetsBySlot).forEach(slotName => {
        widgetsBySlot[slotName].sort((a, b) => {
            const priorityDiff = (b.priority || 0) - (a.priority || 0)
            if (priorityDiff !== 0) return priorityDiff
            return (a.sort_order || 0) - (b.sort_order || 0)
        })
    })

    return widgetsBySlot
}

// Toggle widget visibility
export const toggleWidgetVisibility = async (pageId, widgetId, description = 'Toggled widget visibility') => {
    // Get latest draft
    let version = await getLatestDraft(pageId)
    if (!version) {
        version = await getCurrentVersion(pageId)
        if (version) {
            // Create a draft from published version
            version = await createDraftFromPublished(version.id, 'Draft for widget changes')
        } else {
            throw new Error('No version found for page')
        }
    }

    // Toggle visibility for the specific widget
    const currentWidgets = version.widgets || []
    const updatedWidgets = currentWidgets.map(widget =>
        widget.id === widgetId
            ? { ...widget, is_visible: !widget.is_visible }
            : widget
    )

    // Update the version
    const updatedVersion = await updateVersion(version.id, {
        widgets: updatedWidgets,
        description: description
    })

    const updatedWidget = updatedWidgets.find(w => w.id === widgetId)
    return {
        widget: updatedWidget,
        version: updatedVersion
    }
}

// Widget helper functions for compatibility
export const createWidgetHelper = (widget, widgetType) => {
    return {
        getId: () => widget.id,
        getSlotName: () => widget.slot_name || 'default',
        getConfiguration: () => widget.configuration || {},
        isVisible: () => widget.is_visible !== false,
        isInherited: () => widget.inherited_from !== undefined,
        getInheritedFrom: () => widget.inherited_from,
        getPriority: () => widget.priority || 0,
        getSortOrder: () => widget.sort_order || 0,
        getWidgetType: () => widgetType,
        canEdit: () => !widget.inherited_from || widget.override_parent,
        getInheritanceBehavior: () => widget.inheritance_behavior || 'inherit'
    }
} 