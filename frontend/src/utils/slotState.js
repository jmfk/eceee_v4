/**
 * Slot state management utilities
 * Handles slot-specific logic and widget organization
 * Following Sandi Metz principle: "Ask for what you need, not for what you can get"
 */

export class SlotState {
    constructor(pageWidgetsData = []) {
        this.pageWidgetsData = pageWidgetsData
    }

    /**
     * Organize widgets by slot with proper inheritance metadata
     */
    getWidgetsBySlot() {
        const widgetsBySlot = {}

        this.pageWidgetsData.forEach(item => {
            const widget = item.widget
            const slotName = widget.slot_name

            if (!widgetsBySlot[slotName]) {
                widgetsBySlot[slotName] = []
            }

            widgetsBySlot[slotName].push({
                ...widget,
                inherited_from: item.inherited_from,
                is_inherited: !!item.inherited_from
            })
        })

        // Sort widgets by sort_order within each slot
        Object.keys(widgetsBySlot).forEach(slot => {
            widgetsBySlot[slot].sort((a, b) => a.sort_order - b.sort_order)
        })

        return widgetsBySlot
    }

    /**
     * Get widgets for a specific slot
     */
    getSlotWidgets(slotName) {
        const widgetsBySlot = this.getWidgetsBySlot()
        return widgetsBySlot[slotName] || []
    }

    /**
     * Calculate the next sort order for a slot
     */
    getNextSortOrder(slotName) {
        const slotWidgets = this.getSlotWidgets(slotName)
        const maxOrder = Math.max(...slotWidgets.map(w => w.sort_order), -1)
        return maxOrder + 1
    }

    /**
     * Find widget by ID
     */
    findWidget(widgetId) {
        const allWidgets = this.getAllWidgets()
        return allWidgets.find(w => w.id === widgetId)
    }

    /**
     * Get all widgets flattened from slots
     */
    getAllWidgets() {
        const widgetsBySlot = this.getWidgetsBySlot()
        return Object.values(widgetsBySlot).flat()
    }

    /**
     * Check if a widget can be moved in a direction
     */
    canMoveWidget(widget, direction) {
        const slotWidgets = this.getSlotWidgets(widget.slot_name)
        const currentIndex = slotWidgets.findIndex(w => w.id === widget.id)

        if (currentIndex === -1) return false

        return (direction === 'up' && currentIndex > 0) ||
            (direction === 'down' && currentIndex < slotWidgets.length - 1)
    }

    /**
     * Get the target sort order for moving a widget
     */
    getMoveSortOrder(widget, direction) {
        const slotWidgets = this.getSlotWidgets(widget.slot_name)
        const currentIndex = slotWidgets.findIndex(w => w.id === widget.id)

        if (!this.canMoveWidget(widget, direction)) {
            return null
        }

        if (direction === 'up') {
            return slotWidgets[currentIndex - 1].sort_order
        } else {
            return slotWidgets[currentIndex + 1].sort_order
        }
    }

    /**
     * Check if slot has inherited widgets
     */
    hasInheritedWidgets(slotName) {
        const slotWidgets = this.getSlotWidgets(slotName)
        return slotWidgets.some(w => w.is_inherited)
    }

    /**
     * Get inheritance information for a slot
     */
    getSlotInheritanceInfo(slotName) {
        const slotWidgets = this.getSlotWidgets(slotName)
        const inherited = slotWidgets.filter(w => w.is_inherited)
        const local = slotWidgets.filter(w => !w.is_inherited)

        return {
            total: slotWidgets.length,
            inherited: inherited.length,
            local: local.length,
            inheritanceSources: [...new Set(inherited.map(w => w.inherited_from).filter(Boolean))]
        }
    }

    /**
     * Validate widget action based on inheritance rules
     */
    validateWidgetAction(widget, action) {
        const errors = []

        if (widget.is_inherited && action === 'delete') {
            errors.push('Cannot delete inherited widgets. Override them instead.')
        }

        if (widget.is_inherited && action === 'move') {
            errors.push('Cannot reorder inherited widgets. Override them first.')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Get slots with their widget counts and inheritance status
     */
    getSlotSummary() {
        const widgetsBySlot = this.getWidgetsBySlot()
        const summary = {}

        Object.keys(widgetsBySlot).forEach(slotName => {
            summary[slotName] = this.getSlotInheritanceInfo(slotName)
        })

        return summary
    }
}

/**
 * Factory for creating SlotState instances
 */
export class SlotStateFactory {
    static create(pageWidgetsData) {
        return new SlotState(pageWidgetsData)
    }

    static createFromQuery(queryData) {
        return new SlotState(queryData?.widgets || [])
    }
} 