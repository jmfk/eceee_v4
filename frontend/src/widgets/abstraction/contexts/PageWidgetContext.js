/**
 * Page Widget Context Implementation
 * 
 * Implements the IWidgetContext interface for page editing contexts.
 * Handles layout-based slots, inheritance, and template-based configurations.
 */

import { IWidgetContext, ISlot } from '../interfaces'
import { createWidget } from '../../shared/utils/widgetFactory'
import { validateWidgetConfig } from '../../shared/utils/validation'
import { WIDGET_CONTEXTS } from '../../shared/utils/adapters'

/**
 * Page-specific slot implementation
 */
export class TemplateSlot extends ISlot {
    constructor(slotData, layoutJson, pageVersionData) {
        super()
        this._slotData = slotData
        this._layoutJson = layoutJson
        this._pageVersionData = pageVersionData
    }

    get id() {
        return this._slotData.name
    }

    get label() {
        return this._slotData.label || this._slotData.name
    }

    get accepts() {
        return this._slotData.allowedTypes || null // null = accepts all
    }

    get maxWidgets() {
        return this._slotData.maxWidgets || null // null = unlimited
    }

    get minWidgets() {
        return this._slotData.minWidgets || 0
    }

    get supportsInheritance() {
        return true
    }

    get templateWidgets() {
        return this._slotData.templateWidgets || []
    }

    get inheritanceLevel() {
        return this._slotData.inheritanceLevel || 0
    }

    getWidgets() {
        const slotWidgets = this._pageVersionData?.widgets?.[this.id] || []

        // For pages, we need to consider template inheritance
        if (this.supportsInheritance && this.templateWidgets.length > 0) {
            // Merge template widgets with page-specific widgets
            const templateWidgets = this.templateWidgets.map(widget => ({
                ...widget,
                inherited: true,
                inheritanceLevel: this.inheritanceLevel
            }))

            // Page widgets override template widgets
            return [...templateWidgets, ...slotWidgets]
        }

        return slotWidgets
    }

    /**
     * Check if this slot can inherit widgets from parent templates
     * @returns {boolean} Whether inheritance is possible
     */
    canInherit() {
        return this.supportsInheritance && this.templateWidgets.length > 0
    }

    /**
     * Get inherited widgets from templates
     * @returns {Widget[]} Inherited widgets
     */
    getInheritedWidgets() {
        if (!this.canInherit()) return []

        return this.templateWidgets.map(widget => ({
            ...widget,
            inherited: true,
            inheritanceLevel: this.inheritanceLevel,
            readonly: true // Inherited widgets are typically readonly
        }))
    }

    /**
     * Get page-specific widgets (non-inherited)
     * @returns {Widget[]} Page-specific widgets
     */
    getPageWidgets() {
        return this._pageVersionData?.widgets?.[this.id] || []
    }
}

/**
 * Page Widget Context - Handles page-specific widget operations
 */
export class PageWidgetContext extends IWidgetContext {
    constructor(options = {}) {
        super()
        this._layoutJson = options.layoutJson || {}
        this._pageVersionData = options.pageVersionData || {}
        this._webpageData = options.webpageData || {}
        this._onUpdate = options.onUpdate || (() => { })
        this._onError = options.onError || (() => { })
        this._editable = options.editable !== false

        // Initialize slots from layout JSON
        this._initializeSlots()
    }

    get type() {
        return WIDGET_CONTEXTS.PAGE
    }

    /**
     * Initialize slots from layout JSON
     */
    _initializeSlots() {
        this._slots = []

        if (this._layoutJson?.slots) {
            Object.entries(this._layoutJson.slots).forEach(([slotName, slotData]) => {
                const slot = new TemplateSlot(
                    { name: slotName, ...slotData },
                    this._layoutJson,
                    this._pageVersionData
                )
                this._slots.push(slot)
            })
        }
    }

    getSlots() {
        return this._slots
    }

    getWidgets(slotId) {
        const slot = this._slots.find(s => s.id === slotId)
        return slot ? slot.getWidgets() : []
    }

    async addWidget(slotId, widget) {
        try {
            // Validate widget can be added to slot
            if (!this.canAddWidget(slotId, widget.type)) {
                return {
                    success: false,
                    error: `Widget type '${widget.type}' cannot be added to slot '${slotId}'`
                }
            }

            // Get current widgets
            const currentWidgets = { ...this._pageVersionData.widgets }

            // Initialize slot if it doesn't exist
            if (!currentWidgets[slotId]) {
                currentWidgets[slotId] = []
            }

            // Add context-specific properties to widget
            const pageWidget = {
                ...widget,
                context: this.type,
                canInherit: true,
                templateBased: true,
                allowOverride: true,
                pageId: this._webpageData.id,
                versionId: this._pageVersionData.id
            }

            // Add widget to slot
            currentWidgets[slotId] = [...currentWidgets[slotId], pageWidget]

            // Update page version data
            const updatedPageVersionData = {
                ...this._pageVersionData,
                widgets: currentWidgets
            }

            // Notify of changes
            this._onUpdate({ widgets: currentWidgets })

            return {
                success: true,
                data: {
                    widget: pageWidget,
                    slotId,
                    widgets: currentWidgets
                }
            }
        } catch (error) {
            this._onError(error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    async removeWidget(widgetId) {
        try {
            const currentWidgets = { ...this._pageVersionData.widgets }
            let removedWidget = null
            let slotId = null

            // Find and remove widget from its slot
            Object.entries(currentWidgets).forEach(([slot, widgets]) => {
                const widgetIndex = widgets.findIndex(w => w.id === widgetId)
                if (widgetIndex !== -1) {
                    removedWidget = widgets[widgetIndex]
                    slotId = slot
                    currentWidgets[slot] = widgets.filter(w => w.id !== widgetId)
                }
            })

            if (!removedWidget) {
                return {
                    success: false,
                    error: `Widget '${widgetId}' not found`
                }
            }

            // Notify of changes
            this._onUpdate({ widgets: currentWidgets })

            return {
                success: true,
                data: {
                    removedWidget,
                    slotId,
                    widgets: currentWidgets
                }
            }
        } catch (error) {
            this._onError(error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    async updateWidget(widgetId, config) {
        try {
            const currentWidgets = { ...this._pageVersionData.widgets }
            let updatedWidget = null
            let slotId = null

            // Find and update widget
            Object.entries(currentWidgets).forEach(([slot, widgets]) => {
                const widgetIndex = widgets.findIndex(w => w.id === widgetId)
                if (widgetIndex !== -1) {
                    updatedWidget = {
                        ...widgets[widgetIndex],
                        config,
                        updatedAt: new Date().toISOString()
                    }
                    slotId = slot
                    currentWidgets[slot] = [
                        ...widgets.slice(0, widgetIndex),
                        updatedWidget,
                        ...widgets.slice(widgetIndex + 1)
                    ]
                }
            })

            if (!updatedWidget) {
                return {
                    success: false,
                    error: `Widget '${widgetId}' not found`
                }
            }

            // Validate updated widget
            const validation = this.validateWidget(updatedWidget)
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Widget validation failed: ${validation.errors.join(', ')}`
                }
            }

            // Notify of changes
            this._onUpdate({ widgets: currentWidgets })

            return {
                success: true,
                data: {
                    widget: updatedWidget,
                    slotId,
                    widgets: currentWidgets
                }
            }
        } catch (error) {
            this._onError(error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    validateWidget(widget) {
        try {
            // Use shared validation utility with page context
            return validateWidgetConfig(widget, {
                context: this.type,
                supportsInheritance: true,
                templateBased: true
            })
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings: []
            }
        }
    }

    canAddWidget(slotId, widgetType) {
        const slot = this._slots.find(s => s.id === slotId)
        if (!slot) return false

        // Check if widget type is allowed
        if (!slot.allowsWidgetType(widgetType)) return false

        // Check if slot has space
        if (!slot.hasSpace()) return false

        // Page context is generally permissive
        return this._editable
    }

    getAvailableWidgetTypes(slotId) {
        const slot = this._slots.find(s => s.id === slotId)
        if (!slot) return []

        // If slot accepts specific types, return those
        if (slot.accepts && slot.accepts.length > 0) {
            return slot.accepts.map(type => ({
                slug: type,
                name: type, // Would typically get display name from registry
                context: this.type
            }))
        }

        // Otherwise return all available widget types for page context
        // This would typically come from the widget registry
        return [
            'text-block',
            'image',
            'button',
            'html-block',
            'spacer',
            'list',
            'grid',
            'card'
        ].map(type => ({
            slug: type,
            name: type,
            context: this.type
        }))
    }

    async save() {
        try {
            // In a real implementation, this would save to the backend API
            // For now, just validate and return success
            const allWidgets = []
            Object.values(this._pageVersionData.widgets || {}).forEach(slotWidgets => {
                allWidgets.push(...slotWidgets)
            })

            // Validate all widgets
            const validationErrors = []
            allWidgets.forEach(widget => {
                const validation = this.validateWidget(widget)
                if (!validation.isValid) {
                    validationErrors.push(...validation.errors)
                }
            })

            if (validationErrors.length > 0) {
                return {
                    success: false,
                    error: `Validation failed: ${validationErrors.join(', ')}`
                }
            }

            return {
                success: true,
                data: {
                    pageVersionData: this._pageVersionData,
                    savedAt: new Date().toISOString()
                }
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * Get slot by ID
     * @param {string} slotId - Slot identifier
     * @returns {TemplateSlot|null} Slot instance or null
     */
    getSlot(slotId) {
        return this._slots.find(s => s.id === slotId) || null
    }

    /**
     * Update context data
     * @param {Object} updates - Data updates
     */
    updateData(updates) {
        if (updates.layoutJson) {
            this._layoutJson = updates.layoutJson
            this._initializeSlots()
        }
        if (updates.pageVersionData) {
            this._pageVersionData = updates.pageVersionData
            this._initializeSlots()
        }
        if (updates.webpageData) {
            this._webpageData = updates.webpageData
        }
    }

    /**
     * Check if context is editable
     * @returns {boolean} Whether context allows editing
     */
    isEditable() {
        return this._editable
    }

    /**
     * Get context metadata
     * @returns {Object} Context metadata
     */
    getMetadata() {
        return {
            type: this.type,
            pageId: this._webpageData.id,
            versionId: this._pageVersionData.id,
            layoutId: this._layoutJson.id,
            slotCount: this._slots.length,
            totalWidgets: Object.values(this._pageVersionData.widgets || {})
                .reduce((total, slotWidgets) => total + slotWidgets.length, 0),
            editable: this._editable
        }
    }
}

export default PageWidgetContext
