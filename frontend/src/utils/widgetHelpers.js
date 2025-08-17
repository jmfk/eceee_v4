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
            inheritFromParent: this.widget.inheritFromParent,
            override_parent: this.widget.override_parent,
            inheritance_behavior: this.widget.inheritance_behavior || 'inherit',
            inheritance_conditions: this.widget.inheritance_conditions || {},
            priority: this.widget.priority || 0,
            isVisible: this.widget.isVisible !== false,
            maxInheritanceDepth: this.widget.maxInheritanceDepth
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
        return this.widget.isVisible !== false
    }

    // Check if widget is inherited
    isInherited() {
        return this.widget.isInherited
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
        return this.widgetType?.name || this.widget.widgetType?.name || 'Unknown'
    }

    getTypeDescription() {
        return this.widgetType?.description || this.widget.widgetType?.description || ''
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
            inheritFromParent: widget.inheritFromParent,
            override_parent: widget.override_parent,
            inheritance_behavior: widget.inheritance_behavior || 'inherit',
            inheritance_conditions: widget.inheritance_conditions || {},
            priority: widget.priority || 0,
            isVisible: widget.isVisible !== false,
            maxInheritanceDepth: widget.maxInheritanceDepth
        }
    },

    // Get widget display information
    getWidgetDisplayInfo: (widget) => {
        return {
            name: widget.widgetType?.name || 'Unknown',
            description: widget.widgetType?.description || '',
            priority: widget.priority || 0,
            isInherited: widget.isInherited,
            isVisible: widget.isVisible !== false,
            inheritanceBehavior: widget.inheritance_behavior || 'inherit'
        }
    }
} 