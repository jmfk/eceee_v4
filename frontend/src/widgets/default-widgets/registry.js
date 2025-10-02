/**
 * Shared Widget Registry - Core widget implementations
 * 
 * This registry contains only the core widget implementations that are shared
 * between all editors. Framework-specific behaviors are handled by the editor
 * frameworks, not here.
 */

// Import default widget implementations
import ContentWidget from './ContentWidget'
import ImageWidget from './ImageWidget'
import TableWidget from './TableWidget'
import FooterWidget from './FooterWidget'
import HeaderWidget from './HeaderWidget'
import NavigationWidget from './NavigationWidget'
import SidebarWidget from './SidebarWidget'
import FormsWidget from './FormsWidget'

// Import container widget implementations
import TwoColumnsWidget from './TwoColumnsWidget'

/**
 * Auto-collect metadata from widget components with optional override
 * This ensures consistency and reduces boilerplate while allowing manual control
 * 
 * @param {React.Component} WidgetComponent - The widget component
 * @param {string} [overrideWidgetType] - Optional manual widget type override
 */
const collectWidgetMetadata = (WidgetComponent, overrideWidgetType = null) => {
    return {
        component: WidgetComponent,
        displayName: WidgetComponent.displayName,
        // Use override if provided, otherwise use component's widgetType, otherwise generate default
        widgetType: overrideWidgetType || WidgetComponent.widgetType || `default_widgets.${WidgetComponent.displayName}`,
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
 * Register a widget with automatic or manual widget type
 * 
 * @param {React.Component} WidgetComponent - The widget component
 * @param {string} [customWidgetType] - Optional custom widget type (e.g., 'default_widgets.ContentWidget')
 * @returns {Object} Widget metadata object
 */
const registerWidget = (WidgetComponent, customWidgetType = null) => {
    return collectWidgetMetadata(WidgetComponent, customWidgetType)
}

/**
 * Core Widget Registry - Shared implementations only
 * 
 * This registry contains widget implementations that work the same way
 * across all editors. Framework-specific wrappers and behaviors are
 * handled by the editor frameworks.
 */
export const CORE_WIDGET_REGISTRY = {
    // Registry key MUST match the widget type for lookup to work
    'default_widgets.ContentWidget': registerWidget(ContentWidget, 'default_widgets.ContentWidget'),
    'default_widgets.ImageWidget': registerWidget(ImageWidget, 'default_widgets.ImageWidget'),
    'default_widgets.TableWidget': registerWidget(TableWidget, 'default_widgets.TableWidget'),
    'default_widgets.FooterWidget': registerWidget(FooterWidget, 'default_widgets.FooterWidget'),
    'default_widgets.HeaderWidget': registerWidget(HeaderWidget, 'default_widgets.HeaderWidget'),
    'default_widgets.NavigationWidget': registerWidget(NavigationWidget, 'default_widgets.NavigationWidget'),
    'default_widgets.SidebarWidget': registerWidget(SidebarWidget, 'default_widgets.SidebarWidget'),
    'default_widgets.FormsWidget': registerWidget(FormsWidget, 'default_widgets.FormsWidget'),
    'default_widgets.TwoColumnsWidget': registerWidget(TwoColumnsWidget, 'default_widgets.TwoColumnsWidget')
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
            return registryEntry.metadata.display_name
        }

        // Fallback to API data if available
        const widgetTypeData = widgetTypes.find(w => w.type === widgetTypeOrData)
        if (widgetTypeData) {
            return widgetTypeData.display_name || widgetTypeData.label || widgetTypeData.name || widgetTypeOrData
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

// Export utilities for other widget packages
export { registerWidget }

// Export the registry for direct access if needed
export default CORE_WIDGET_REGISTRY
