/**
 * Widget Factory - Creates and manages widget instances
 * 
 * Provides a unified interface for creating widgets across different contexts
 * (page editing vs object editing) while maintaining type safety and validation.
 */

import { WIDGET_EDITORS } from '../../../components/widget-editors'

/**
 * Widget type registry - maps widget slugs to their display names and metadata
 */
export const WIDGET_TYPE_REGISTRY = {
    'text-block': {
        name: 'Text Block',
        slug: 'text-block',
        category: 'content',
        description: 'Rich text content with formatting options',
        icon: 'Type',
        defaultConfig: {
            title: '',
            content: 'Click to edit this content...',
            alignment: 'left'
        }
    },
    'image': {
        name: 'Image',
        slug: 'image',
        category: 'media',
        description: 'Display images with optional captions and links',
        icon: 'Image',
        defaultConfig: {
            src: '',
            alt: '',
            caption: '',
            link: '',
            alignment: 'center'
        }
    },
    'button': {
        name: 'Button',
        slug: 'button',
        category: 'interactive',
        description: 'Call-to-action buttons with customizable styling',
        icon: 'MousePointer',
        defaultConfig: {
            text: 'Click me',
            url: '',
            style: 'primary',
            size: 'medium',
            openInNewTab: false
        }
    },
    'html-block': {
        name: 'HTML Block',
        slug: 'html-block',
        category: 'advanced',
        description: 'Custom HTML content for advanced users',
        icon: 'Code',
        defaultConfig: {
            html: '<p>Enter your HTML here...</p>'
        }
    },
    'spacer': {
        name: 'Spacer',
        slug: 'spacer',
        category: 'layout',
        description: 'Add vertical spacing between content',
        icon: 'Minus',
        defaultConfig: {
            height: 20,
            unit: 'px'
        }
    },
    'gallery': {
        name: 'Gallery',
        slug: 'gallery',
        category: 'media',
        description: 'Image gallery with multiple layout options',
        icon: 'Grid',
        defaultConfig: {
            images: [],
            columns: 3,
            spacing: 10,
            showCaptions: true
        }
    },
    'news': {
        name: 'News',
        slug: 'news',
        category: 'content',
        description: 'Display news articles and updates',
        icon: 'Newspaper',
        defaultConfig: {
            title: 'Latest News',
            count: 5,
            showDate: true,
            showExcerpt: true
        }
    },
    'events': {
        name: 'Events',
        slug: 'events',
        category: 'content',
        description: 'Display upcoming events and dates',
        icon: 'Calendar',
        defaultConfig: {
            title: 'Upcoming Events',
            count: 5,
            showDate: true,
            showLocation: true
        }
    },
    'calendar': {
        name: 'Calendar',
        slug: 'calendar',
        category: 'content',
        description: 'Interactive calendar display',
        icon: 'CalendarDays',
        defaultConfig: {
            view: 'month',
            showEvents: true,
            highlightToday: true
        }
    },
    'forms': {
        name: 'Forms',
        slug: 'forms',
        category: 'interactive',
        description: 'Contact and feedback forms',
        icon: 'FileText',
        defaultConfig: {
            title: 'Contact Us',
            fields: [],
            submitText: 'Submit'
        }
    },
    'object-list': {
        name: 'Object List',
        slug: 'object-list',
        category: 'data',
        description: 'Display lists of objects from the object storage system',
        icon: 'List',
        defaultConfig: {
            objectType: null,
            count: 10,
            showPagination: true,
            layout: 'list'
        }
    }
}

/**
 * Create a new widget instance
 * @param {string} widgetSlug - The widget type slug
 * @param {Object} options - Widget creation options
 * @param {string} options.context - 'page' or 'object' context
 * @param {Object} options.config - Initial configuration
 * @param {Object} options.slotConfig - Slot configuration if applicable
 * @param {string} options.controlId - Widget control ID for object widgets
 * @returns {Object} New widget instance
 */
export function createWidget(widgetSlug, options = {}) {
    const {
        context = 'page',
        config = {},
        slotConfig = null,
        controlId = null
    } = options

    const widgetType = WIDGET_TYPE_REGISTRY[widgetSlug]
    if (!widgetType) {
        throw new Error(`Unknown widget type: ${widgetSlug}`)
    }

    // Generate unique widget ID
    const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Merge default config with provided config
    const mergedConfig = {
        ...widgetType.defaultConfig,
        ...config
    }

    const widget = {
        id: widgetId,
        type: widgetType.name,
        slug: widgetSlug,
        config: mergedConfig,
        context,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }

    // Add object-specific properties if in object context
    if (context === 'object' && controlId) {
        widget.controlId = controlId
    }

    return widget
}

/**
 * Clone an existing widget
 * @param {Object} widget - Widget to clone
 * @param {Object} overrides - Properties to override
 * @returns {Object} Cloned widget with new ID
 */
export function cloneWidget(widget, overrides = {}) {
    const clonedWidget = {
        ...widget,
        id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    }

    return clonedWidget
}

/**
 * Update widget configuration
 * @param {Object} widget - Widget to update
 * @param {Object} newConfig - New configuration
 * @returns {Object} Updated widget
 */
export function updateWidgetConfig(widget, newConfig) {
    return {
        ...widget,
        config: {
            ...widget.config,
            ...newConfig
        },
        updatedAt: new Date().toISOString()
    }
}

/**
 * Get widget display name from slug
 * @param {string} widgetSlug - Widget slug
 * @returns {string} Display name
 */
export function getWidgetDisplayName(widgetSlug) {
    return WIDGET_TYPE_REGISTRY[widgetSlug]?.name || widgetSlug
}

/**
 * Get all widget types for a specific category
 * @param {string} category - Widget category
 * @returns {Array} Array of widget types in the category
 */
export function getWidgetsByCategory(category) {
    return Object.entries(WIDGET_TYPE_REGISTRY)
        .filter(([slug, type]) => type.category === category)
        .map(([slug, type]) => ({ slug, ...type }))
}

/**
 * Get all widget categories
 * @returns {Array} Array of unique categories
 */
export function getWidgetCategories() {
    const categories = new Set()
    Object.values(WIDGET_TYPE_REGISTRY).forEach(type => {
        categories.add(type.category)
    })
    return Array.from(categories)
}

/**
 * Check if a widget type has an editor component
 * @param {string} widgetSlug - Widget slug or display name
 * @returns {boolean} True if editor exists
 */
export function hasWidgetEditor(widgetSlug) {
    const widgetType = WIDGET_TYPE_REGISTRY[widgetSlug]
    const displayName = widgetType?.name || widgetSlug
    return !!WIDGET_EDITORS[displayName]
}

/**
 * Get the editor component for a widget type
 * @param {string} widgetSlug - Widget slug or display name
 * @returns {React.Component|null} Editor component or null if not found
 */
export function getWidgetEditorComponent(widgetSlug) {
    const widgetType = WIDGET_TYPE_REGISTRY[widgetSlug]
    const displayName = widgetType?.name || widgetSlug
    return WIDGET_EDITORS[displayName] || WIDGET_EDITORS['Default'] || null
}

/**
 * Validate widget configuration against its schema
 * @param {Object} widget - Widget to validate
 * @returns {Object} Validation result with errors array
 */
export function validateWidget(widget) {
    const errors = []
    const warnings = []

    // Basic validation
    if (!widget.id) {
        errors.push('Widget ID is required')
    }

    if (!widget.type && !widget.slug) {
        errors.push('Widget type or slug is required')
    }

    if (!widget.config || typeof widget.config !== 'object') {
        errors.push('Widget config must be an object')
    }

    // Type-specific validation
    const widgetType = WIDGET_TYPE_REGISTRY[widget.slug]
    if (widgetType) {
        // Validate required fields based on widget type
        switch (widget.slug) {
            case 'image':
                if (!widget.config.src) {
                    errors.push('Image source is required')
                }
                break
            case 'button':
                if (!widget.config.text) {
                    errors.push('Button text is required')
                }
                break
            case 'object-list':
                if (!widget.config.objectType) {
                    warnings.push('Object type should be specified for object list widget')
                }
                break
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    }
}
