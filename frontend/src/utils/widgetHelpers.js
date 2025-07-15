// Widget utility functions to encapsulate widget property access
// This reduces "feature envy" by providing a clean interface to widget data

export class WidgetModel {
    constructor(widget, widgetType) {
        this.widget = widget
        this.widgetType = widgetType
    }

    // Get inheritance settings from widget
    getInheritanceSettings() {
        return {
            inherit_from_parent: this.widget.inherit_from_parent,
            override_parent: this.widget.override_parent,
            inheritance_behavior: this.widget.inheritance_behavior || 'inherit',
            inheritance_conditions: this.widget.inheritance_conditions || {},
            priority: this.widget.priority || 0,
            is_visible: this.widget.is_visible !== false,
            max_inheritance_depth: this.widget.max_inheritance_depth
        }
    }

    // Get widget configuration
    getConfiguration() {
        return this.widget.configuration || {}
    }

    // Get widget priority
    getPriority() {
        return this.widget.priority || 0
    }

    // Check if widget is visible
    isVisible() {
        return this.widget.is_visible !== false
    }

    // Check if widget is inherited
    isInherited() {
        return this.widget.is_inherited
    }

    // Get inheritance behavior
    getInheritanceBehavior() {
        return this.widget.inheritance_behavior || 'inherit'
    }

    // Get widget display classes for styling
    getCardClasses() {
        if (this.isInherited()) {
            return 'border-orange-200 bg-orange-50'
        }
        if (!this.isVisible()) {
            return 'border-gray-200 bg-gray-50 opacity-60'
        }
        return 'border-gray-200 bg-white'
    }

    // Get widget type information
    getTypeName() {
        return this.widgetType?.name || this.widget.widget_type?.name || 'Unknown'
    }

    getTypeDescription() {
        return this.widgetType?.description || this.widget.widget_type?.description || ''
    }
}

// Factory function to create WidgetModel instances
export const createWidgetModel = (widget, widgetType) => {
    return new WidgetModel(widget, widgetType)
}

// Utility functions for widget operations
export const widgetHelpers = {
    // Extract inheritance settings from a widget
    extractInheritanceSettings: (widget) => {
        return {
            inherit_from_parent: widget.inherit_from_parent,
            override_parent: widget.override_parent,
            inheritance_behavior: widget.inheritance_behavior || 'inherit',
            inheritance_conditions: widget.inheritance_conditions || {},
            priority: widget.priority || 0,
            is_visible: widget.is_visible !== false,
            max_inheritance_depth: widget.max_inheritance_depth
        }
    },

    // Get widget display information
    getWidgetDisplayInfo: (widget) => {
        return {
            name: widget.widget_type?.name || 'Unknown',
            description: widget.widget_type?.description || '',
            priority: widget.priority || 0,
            isInherited: widget.is_inherited,
            isVisible: widget.is_visible !== false,
            inheritanceBehavior: widget.inheritance_behavior || 'inherit'
        }
    }
} 