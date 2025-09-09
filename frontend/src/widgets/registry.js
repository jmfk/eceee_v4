/**
 * Shared Widget Registry - Core widget implementations
 * 
 * This registry contains only the core widget implementations that are shared
 * between all editors. Framework-specific behaviors are handled by the editor
 * frameworks, not here.
 */

// Import core widget implementations
import ContentWidget from './core/ContentWidget'
import ImageWidget from './core/ImageWidget'
import TableWidget from './core/TableWidget'
import FooterWidget from './core/FooterWidget'
import HeaderWidget from './core/HeaderWidget'
import NavigationWidget from './core/NavigationWidget'
import SidebarWidget from './core/SidebarWidget'
import FormsWidget from './core/FormsWidget'

/**
 * Auto-collect metadata from widget components
 * This ensures consistency and reduces boilerplate
 */
const collectWidgetMetadata = (WidgetComponent) => {
    return {
        component: WidgetComponent,
        displayName: WidgetComponent.displayName,
        widgetType: WidgetComponent.widgetType,
        defaultConfig: WidgetComponent.defaultConfig || {},
        actionHandlers: WidgetComponent.actionHandlers || {},
        metadata: WidgetComponent.metadata || {
            name: WidgetComponent.displayName,
            description: '',
            category: 'other',
            icon: null,
            tags: [],
            menuItems: []
        }
    }
}

/**
 * Core Widget Registry - Shared implementations only
 * 
 * This registry contains widget implementations that work the same way
 * across all editors. Framework-specific wrappers and behaviors are
 * handled by the editor frameworks.
 */
export const CORE_WIDGET_REGISTRY = {
    'core_widgets.ContentWidget': collectWidgetMetadata(ContentWidget),
    'core_widgets.ImageWidget': collectWidgetMetadata(ImageWidget),
    'core_widgets.TableWidget': collectWidgetMetadata(TableWidget),
    'core_widgets.FooterWidget': collectWidgetMetadata(FooterWidget),
    'core_widgets.HeaderWidget': collectWidgetMetadata(HeaderWidget),
    'core_widgets.NavigationWidget': collectWidgetMetadata(NavigationWidget),
    'core_widgets.SidebarWidget': collectWidgetMetadata(SidebarWidget),
    'core_widgets.FormsWidget': collectWidgetMetadata(FormsWidget)
}

// === CORE UTILITY FUNCTIONS ===

/**
 * Get core widget component by type
 * @param {string} widgetType - Widget type identifier
 * @returns {React.Component|null} Widget component or null if not found
 */
export const getCoreWidgetComponent = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.component || null
}

/**
 * Get widget default configuration
 * @param {string} widgetType - Widget type identifier
 * @returns {Object} Default configuration object
 */
export const getCoreWidgetDefaultConfig = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.defaultConfig || {}
}

/**
 * Get widget display name
 * @param {string|Object} widgetTypeOrData - Widget type string or widget data object
 * @param {Array} widgetTypes - Optional array of widget type data from API
 * @returns {string} Display name
 */
export const getCoreWidgetDisplayName = (widgetTypeOrData, widgetTypes = []) => {
    // If widgetTypeOrData is an object (widget type data), extract name from it
    if (typeof widgetTypeOrData === 'object' && widgetTypeOrData !== null) {
        return widgetTypeOrData.name || widgetTypeOrData.label || widgetTypeOrData.display_name || widgetTypeOrData.type
    }

    // If widgetTypeOrData is a string (widget type), look it up in registry first
    if (typeof widgetTypeOrData === 'string') {
        const registryEntry = CORE_WIDGET_REGISTRY[widgetTypeOrData]
        if (registryEntry) {
            return registryEntry.metadata.name
        }

        // Fallback to API data if available
        const widgetTypeData = widgetTypes.find(w => w.type === widgetTypeOrData)
        if (widgetTypeData) {
            return widgetTypeData.name || widgetTypeData.label || widgetTypeData.display_name || widgetTypeOrData
        }

        // Last resort fallback
        return widgetTypeOrData
    }

    return widgetTypeOrData || 'Unknown Widget'
}

/**
 * Get widget metadata
 * @param {string} widgetType - Widget type identifier
 * @returns {Object} Widget metadata
 */
export const getCoreWidgetMetadata = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.metadata || {}
}

/**
 * Get widget icon component
 * @param {string} widgetType - Widget type identifier
 * @returns {React.Component|null} Icon component or null
 */
export const getCoreWidgetIcon = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.metadata?.icon || null
}

/**
 * Get widget category
 * @param {string} widgetType - Widget type identifier
 * @returns {string} Widget category
 */
export const getCoreWidgetCategory = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.metadata?.category || 'other'
}

/**
 * Get widget description
 * @param {string} widgetType - Widget type identifier
 * @returns {string} Widget description
 */
export const getCoreWidgetDescription = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.metadata?.description || ''
}

/**
 * Get widget tags for search
 * @param {string} widgetType - Widget type identifier
 * @returns {Array} Array of tags
 */
export const getCoreWidgetTags = (widgetType) => {
    return CORE_WIDGET_REGISTRY[widgetType]?.metadata?.tags || []
}

/**
 * Check if widget type is supported in core registry
 * @param {string} widgetType - Widget type identifier
 * @returns {boolean} True if supported
 */
export const isCoreWidgetTypeSupported = (widgetType) => {
    return widgetType in CORE_WIDGET_REGISTRY
}

/**
 * Get all available core widget types
 * @returns {Array} Array of widget type strings
 */
export const getAvailableCoreWidgetTypes = () => {
    return Object.keys(CORE_WIDGET_REGISTRY)
}

/**
 * Get all core widget metadata
 * @returns {Object} Object mapping widget types to metadata
 */
export const getAllCoreWidgetMetadata = () => {
    return Object.fromEntries(
        Object.entries(CORE_WIDGET_REGISTRY).map(([type, data]) => [
            type,
            data.metadata
        ])
    )
}

/**
 * Search core widgets by term (name, description, tags)
 * @param {string} searchTerm - Search term
 * @returns {Array} Array of matching widget types
 */
export const searchCoreWidgets = (searchTerm = '') => {
    if (!searchTerm.trim()) {
        return Object.keys(CORE_WIDGET_REGISTRY)
    }

    const term = searchTerm.toLowerCase()
    return Object.entries(CORE_WIDGET_REGISTRY)
        .filter(([type, data]) => {
            const metadata = data.metadata
            return (
                metadata.name.toLowerCase().includes(term) ||
                metadata.description.toLowerCase().includes(term) ||
                metadata.tags.some(tag => tag.toLowerCase().includes(term)) ||
                type.toLowerCase().includes(term)
            )
        })
        .map(([type]) => type)
}

/**
 * Filter core widgets by category
 * @param {string} category - Category to filter by ('all' for no filter)
 * @returns {Array} Array of widget types in category
 */
export const filterCoreWidgetsByCategory = (category = 'all') => {
    if (category === 'all') {
        return Object.keys(CORE_WIDGET_REGISTRY)
    }

    return Object.entries(CORE_WIDGET_REGISTRY)
        .filter(([type, data]) => data.metadata.category === category)
        .map(([type]) => type)
}

/**
 * Get all available categories from core widgets
 * @returns {Array} Array of category strings
 */
export const getAvailableCoreCategories = () => {
    const categories = new Set()
    Object.values(CORE_WIDGET_REGISTRY).forEach(data => {
        categories.add(data.metadata.category)
    })
    return Array.from(categories).sort()
}

// Export the registry for direct access if needed
export default CORE_WIDGET_REGISTRY
