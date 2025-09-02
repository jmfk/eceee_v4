/**
 * Object Widget Context Implementation
 * 
 * Implements the IWidgetContext interface for object editing contexts.
 * Handles object type slots, widget controls, and type restrictions.
 */

import { IWidgetContext, ISlot } from '../interfaces'
import { createWidget } from '../../shared/utils/widgetFactory'
import { validateWidgetConfig } from '../../shared/utils/validation'
import { WIDGET_CONTEXTS } from '../../shared/utils/adapters'

/**
 * Object-specific slot implementation
 */
export class ConfiguredSlot extends ISlot {
    constructor(slotData, objectType, objectWidgets) {
        super()
        this._slotData = slotData
        this._objectType = objectType
        this._objectWidgets = objectWidgets
    }

    get id() {
        return this._slotData.name
    }

    get label() {
        return this._slotData.label || this._slotData.name
    }

    get accepts() {
        // Object slots are restricted by widget controls
        if (this._slotData.widgetControls && this._slotData.widgetControls.length > 0) {
            return this._slotData.widgetControls.map(control => control.widgetType)
        }
        return null // No restrictions if no controls defined
    }

    get maxWidgets() {
        return this._slotData.maxWidgets || 1 // Objects default to 1 widget per slot
    }

    get minWidgets() {
        return this._slotData.minWidgets || (this._slotData.required ? 1 : 0)
    }

    get widgetControls() {
        return this._slotData.widgetControls || []
    }

    get strictTypes() {
        return true // Object slots enforce strict typing
    }

    get supportsInheritance() {
        return false // Object slots don't support inheritance
    }

    getWidgets() {
        return this._objectWidgets[this.id] || []
    }

    /**
     * Get available widget controls for this slot
     * @returns {Object[]} Widget control configurations
     */
    getWidgetControls() {
        return this.widgetControls.map(control => ({
            id: control.id,
            widgetType: control.widgetType,
            label: control.label || control.widgetType,
            defaultConfig: control.defaultConfig || {},
            required: control.required || false,
            description: control.description || ''
        }))
    }

    /**
     * Get widget control by widget type
     * @param {string} widgetType - Widget type to find control for
     * @returns {Object|null} Widget control or null
     */
    getControlForWidgetType(widgetType) {
        return this.widgetControls.find(control => control.widgetType === widgetType) || null
    }

    /**
     * Check if a specific widget control is required
     * @param {string} controlId - Control identifier
     * @returns {boolean} Whether control is required
     */
    isControlRequired(controlId) {
        const control = this.widgetControls.find(c => c.id === controlId)
        return control?.required || false
    }

    /**
     * Validate slot configuration against object type rules
     * @returns {ValidationResult} Validation result
     */
    validate() {
        const baseValidation = super.validate()
        const widgets = this.getWidgets()
        const errors = [...baseValidation.errors]
        const warnings = [...baseValidation.warnings]

        // Check required widget controls
        this.widgetControls.forEach(control => {
            if (control.required) {
                const hasControlWidget = widgets.some(widget =>
                    widget.controlId === control.id ||
                    widget.type === control.widgetType
                )
                if (!hasControlWidget) {
                    errors.push(`Required widget control '${control.label || control.widgetType}' is missing`)
                }
            }
        })

        // Check widget control constraints
        widgets.forEach(widget => {
            const control = this.getControlForWidgetType(widget.type)
            if (!control && this.strictTypes) {
                errors.push(`Widget type '${widget.type}' has no corresponding control in this slot`)
            }
        })

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            slotId: this.id
        }
    }
}

/**
 * Object Widget Context - Handles object-specific widget operations
 */
export class ObjectWidgetContext extends IWidgetContext {
    constructor(options = {}) {
        super()
        this._objectType = options.objectType || {}
        this._objectInstance = options.objectInstance || {}
        this._objectWidgets = options.objectWidgets || {}
        this._onWidgetChange = options.onWidgetChange || (() => { })
        this._onError = options.onError || (() => { })
        this._editable = options.editable !== false

        // Initialize slots from object type configuration
        this._initializeSlots()
    }

    get type() {
        return WIDGET_CONTEXTS.OBJECT
    }

    /**
     * Initialize slots from object type configuration
     */
    _initializeSlots() {
        this._slots = []

        if (this._objectType?.slotConfiguration?.slots) {
            this._objectType.slotConfiguration.slots.forEach(slotData => {
                const slot = new ConfiguredSlot(
                    slotData,
                    this._objectType,
                    this._objectWidgets
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

            const slot = this._slots.find(s => s.id === slotId)
            if (!slot) {
                return {
                    success: false,
                    error: `Slot '${slotId}' not found`
                }
            }

            // Check slot capacity
            if (!slot.hasSpace()) {
                return {
                    success: false,
                    error: `Slot '${slotId}' is at maximum capacity (${slot.maxWidgets})`
                }
            }

            // Get widget control for this widget type
            const control = slot.getControlForWidgetType(widget.type)

            // Add context-specific properties to widget
            const objectWidget = {
                ...widget,
                context: this.type,
                controlId: control?.id || null,
                objectTypeId: this._objectType.id,
                objectInstanceId: this._objectInstance.id,
                canInherit: false,
                templateBased: false,
                strictTypes: true
            }

            // Update object widgets
            const updatedWidgets = { ...this._objectWidgets }
            if (!updatedWidgets[slotId]) {
                updatedWidgets[slotId] = []
            }
            updatedWidgets[slotId] = [...updatedWidgets[slotId], objectWidget]

            // Notify of changes
            this._onWidgetChange(updatedWidgets)

            return {
                success: true,
                data: {
                    widget: objectWidget,
                    slotId,
                    widgets: updatedWidgets
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
            const updatedWidgets = { ...this._objectWidgets }
            let removedWidget = null
            let slotId = null

            // Find and remove widget from its slot
            Object.entries(updatedWidgets).forEach(([slot, widgets]) => {
                const widgetIndex = widgets.findIndex(w => w.id === widgetId)
                if (widgetIndex !== -1) {
                    removedWidget = widgets[widgetIndex]
                    slotId = slot
                    updatedWidgets[slot] = widgets.filter(w => w.id !== widgetId)
                }
            })

            if (!removedWidget) {
                return {
                    success: false,
                    error: `Widget '${widgetId}' not found`
                }
            }

            // Check if removing this widget violates required constraints
            const slot = this._slots.find(s => s.id === slotId)
            if (slot && removedWidget.controlId) {
                const isRequired = slot.isControlRequired(removedWidget.controlId)
                const remainingWidgets = updatedWidgets[slotId] || []
                const hasOtherWidgetsOfSameControl = remainingWidgets.some(w =>
                    w.controlId === removedWidget.controlId
                )

                if (isRequired && !hasOtherWidgetsOfSameControl) {
                    return {
                        success: false,
                        error: `Cannot remove required widget control '${removedWidget.type}'`
                    }
                }
            }

            // Notify of changes
            this._onWidgetChange(updatedWidgets)

            return {
                success: true,
                data: {
                    removedWidget,
                    slotId,
                    widgets: updatedWidgets
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
            const updatedWidgets = { ...this._objectWidgets }
            let updatedWidget = null
            let slotId = null

            // Find and update widget
            Object.entries(updatedWidgets).forEach(([slot, widgets]) => {
                const widgetIndex = widgets.findIndex(w => w.id === widgetId)
                if (widgetIndex !== -1) {
                    updatedWidget = {
                        ...widgets[widgetIndex],
                        config,
                        updatedAt: new Date().toISOString()
                    }
                    slotId = slot
                    updatedWidgets[slot] = [
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
            this._onWidgetChange(updatedWidgets)

            return {
                success: true,
                data: {
                    widget: updatedWidget,
                    slotId,
                    widgets: updatedWidgets
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
            // Use shared validation utility with object context
            const validation = validateWidgetConfig(widget, {
                context: this.type,
                strictTypes: true,
                supportsInheritance: false
            })

            // Additional object-specific validation
            const errors = [...validation.errors]
            const warnings = [...validation.warnings]

            // Check if widget has required controlId for object context
            if (!widget.controlId) {
                warnings.push('Widget does not have an associated control ID')
            }

            // Validate against object type constraints
            if (widget.objectTypeId && widget.objectTypeId !== this._objectType.id) {
                errors.push('Widget object type ID does not match current object type')
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            }
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

        // Check if context is editable
        if (!this._editable) return false

        // Check if widget type is allowed
        if (!slot.allowsWidgetType(widgetType)) return false

        // Check if slot has space
        if (!slot.hasSpace()) return false

        // Check if there's a widget control for this type
        const control = slot.getControlForWidgetType(widgetType)
        if (slot.strictTypes && !control) return false

        return true
    }

    getAvailableWidgetTypes(slotId) {
        const slot = this._slots.find(s => s.id === slotId)
        if (!slot) return []

        // Return widget types from widget controls
        return slot.getWidgetControls().map(control => ({
            slug: control.widgetType,
            name: control.label,
            controlId: control.id,
            defaultConfig: control.defaultConfig,
            required: control.required,
            description: control.description,
            context: this.type
        }))
    }

    async save() {
        try {
            // Validate all widgets
            const allWidgets = []
            Object.values(this._objectWidgets).forEach(slotWidgets => {
                allWidgets.push(...slotWidgets)
            })

            const validationErrors = []
            allWidgets.forEach(widget => {
                const validation = this.validateWidget(widget)
                if (!validation.isValid) {
                    validationErrors.push(...validation.errors)
                }
            })

            // Validate all slots
            this._slots.forEach(slot => {
                const slotValidation = slot.validate()
                if (!slotValidation.isValid) {
                    validationErrors.push(...slotValidation.errors)
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
                    objectWidgets: this._objectWidgets,
                    objectInstance: this._objectInstance,
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
     * @returns {ConfiguredSlot|null} Slot instance or null
     */
    getSlot(slotId) {
        return this._slots.find(s => s.id === slotId) || null
    }

    /**
     * Update context data
     * @param {Object} updates - Data updates
     */
    updateData(updates) {
        if (updates.objectType) {
            this._objectType = updates.objectType
            this._initializeSlots()
        }
        if (updates.objectInstance) {
            this._objectInstance = updates.objectInstance
        }
        if (updates.objectWidgets) {
            this._objectWidgets = updates.objectWidgets
            this._initializeSlots()
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
            objectTypeId: this._objectType.id,
            objectInstanceId: this._objectInstance.id,
            objectTypeName: this._objectType.name,
            slotCount: this._slots.length,
            totalWidgets: Object.values(this._objectWidgets)
                .reduce((total, slotWidgets) => total + slotWidgets.length, 0),
            totalControls: this._slots.reduce((total, slot) =>
                total + slot.widgetControls.length, 0),
            editable: this._editable
        }
    }

    /**
     * Get object type information
     * @returns {Object} Object type data
     */
    getObjectType() {
        return this._objectType
    }

    /**
     * Get object instance information
     * @returns {Object} Object instance data
     */
    getObjectInstance() {
        return this._objectInstance
    }

    /**
     * Check required widget controls compliance
     * @returns {Object} Compliance report
     */
    checkRequiredControlsCompliance() {
        const report = {
            compliant: true,
            missing: [],
            satisfied: []
        }

        this._slots.forEach(slot => {
            slot.widgetControls.forEach(control => {
                if (control.required) {
                    const widgets = slot.getWidgets()
                    const hasControlWidget = widgets.some(widget =>
                        widget.controlId === control.id ||
                        widget.type === control.widgetType
                    )

                    if (hasControlWidget) {
                        report.satisfied.push({
                            slotId: slot.id,
                            controlId: control.id,
                            widgetType: control.widgetType,
                            label: control.label
                        })
                    } else {
                        report.compliant = false
                        report.missing.push({
                            slotId: slot.id,
                            controlId: control.id,
                            widgetType: control.widgetType,
                            label: control.label
                        })
                    }
                }
            })
        })

        return report
    }
}

export default ObjectWidgetContext
