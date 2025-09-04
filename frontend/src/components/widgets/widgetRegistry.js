// Enhanced Widget Registry - auto-discovers metadata from widget components
import TextBlockWidget from './TextBlockWidget'
import ImageWidget from './ImageWidget'
import ButtonWidget from './ButtonWidget'
import SpacerWidget from './SpacerWidget'
import HtmlBlockWidget from './HtmlBlockWidget'
import GalleryWidget from './GalleryWidget'

// Auto-collect metadata from widget components
const collectWidgetMetadata = (WidgetComponent) => {
    return {
        component: WidgetComponent,
        displayName: WidgetComponent.displayName,
        widgetType: WidgetComponent.widgetType,
        defaultConfig: WidgetComponent.defaultConfig || {},
        metadata: WidgetComponent.metadata || {
            name: WidgetComponent.displayName,
            description: '',
            category: 'other',
            icon: null,
            tags: []
        }
    }
}

// Enhanced widget registry with auto-discovered metadata
export const WIDGET_REGISTRY = {
    'core_widgets.TextBlockWidget': collectWidgetMetadata(TextBlockWidget),
    'core_widgets.ImageWidget': collectWidgetMetadata(ImageWidget),
    'core_widgets.ButtonWidget': collectWidgetMetadata(ButtonWidget),
    'core_widgets.SpacerWidget': collectWidgetMetadata(SpacerWidget),
    'core_widgets.HTMLBlockWidget': collectWidgetMetadata(HtmlBlockWidget),
    'core_widgets.GalleryWidget': collectWidgetMetadata(GalleryWidget)
}

// Legacy export for backward compatibility
export const WIDGET_COMPONENTS = Object.fromEntries(
    Object.entries(WIDGET_REGISTRY).map(([type, data]) => [type, data.component])
)

// === UTILITY FUNCTIONS ===

// Get widget component by type
export const getWidgetComponent = (widgetType) => {
    return WIDGET_REGISTRY[widgetType]?.component || null
}

// Get widget default configuration
export const getWidgetDefaultConfig = (widgetType) => {
    return WIDGET_REGISTRY[widgetType]?.defaultConfig || {}
}

// Get widget display name
export const getWidgetDisplayName = (widgetTypeOrData, widgetTypes = []) => {
    // If widgetTypeOrData is an object (widget type data), extract name from it
    if (typeof widgetTypeOrData === 'object' && widgetTypeOrData !== null) {
        return widgetTypeOrData.name || widgetTypeOrData.label || widgetTypeOrData.display_name || widgetTypeOrData.type
    }

    // If widgetTypeOrData is a string (widget type), look it up in registry first
    if (typeof widgetTypeOrData === 'string') {
        const registryEntry = WIDGET_REGISTRY[widgetTypeOrData]
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

// Get widget icon component
export const getWidgetIcon = (widgetType) => {
    return WIDGET_REGISTRY[widgetType]?.metadata?.icon || null
}

// Get widget category
export const getWidgetCategory = (widgetType) => {
    return WIDGET_REGISTRY[widgetType]?.metadata?.category || 'other'
}

// Get widget description
export const getWidgetDescription = (widgetType) => {
    return WIDGET_REGISTRY[widgetType]?.metadata?.description || ''
}

// Get widget tags for search
export const getWidgetTags = (widgetType) => {
    return WIDGET_REGISTRY[widgetType]?.metadata?.tags || []
}

// Get all widget metadata
export const getAllWidgetMetadata = () => {
    return Object.fromEntries(
        Object.entries(WIDGET_REGISTRY).map(([type, data]) => [
            type, 
            data.metadata
        ])
    )
}

// Search widgets by term (name, description, tags)
export const searchWidgets = (searchTerm = '') => {
    if (!searchTerm.trim()) {
        return Object.keys(WIDGET_REGISTRY)
    }

    const term = searchTerm.toLowerCase()
    return Object.entries(WIDGET_REGISTRY)
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

// Filter widgets by category
export const filterWidgetsByCategory = (category = 'all') => {
    if (category === 'all') {
        return Object.keys(WIDGET_REGISTRY)
    }

    return Object.entries(WIDGET_REGISTRY)
        .filter(([type, data]) => data.metadata.category === category)
        .map(([type]) => type)
}

// Get all available categories
export const getAvailableCategories = () => {
    const categories = new Set()
    Object.values(WIDGET_REGISTRY).forEach(data => {
        categories.add(data.metadata.category)
    })
    return Array.from(categories).sort()
}

// Check if widget type is supported
export const isWidgetTypeSupported = (widgetType) => {
    return widgetType in WIDGET_REGISTRY
}

// Get all available widget types
export const getAvailableWidgetTypes = () => {
    return Object.keys(WIDGET_REGISTRY)
}

// Legacy aliases for backward compatibility during transition
export const getNewFormatWidgetComponent = getWidgetComponent
export const getNewFormatWidgetTypes = getAvailableWidgetTypes
export const isNewFormatWidgetTypeSupported = isWidgetTypeSupported
