const toId = value => String(value)

const mergeWidgetUpdate = (widget, updatedWidget) => {
    const {
        slotName: _slotName,
        slot: _slot,
        context: _context,
        widgetPath: _widgetPath,
        widgetUpdates,
        ...canonicalWidget
    } = updatedWidget

    return {
        ...widget,
        ...canonicalWidget,
        ...(widgetUpdates || {}),
        config: { ...(widget.config || {}), ...(canonicalWidget.config || {}) }
    }
}

const updateNestedWidgetAtPath = (slotWidgets = [], pathParts, updatedWidget) => {
    if (pathParts.length < 1) return slotWidgets

    if (pathParts.length === 1) {
        const [targetWidgetId] = pathParts
        return slotWidgets.map(widget =>
            toId(widget.id) === toId(targetWidgetId)
                ? mergeWidgetUpdate(widget, updatedWidget)
                : widget
        )
    }

    const [widgetId, nextSlotName, ...restPath] = pathParts

    return slotWidgets.map(widget => {
        if (toId(widget.id) !== toId(widgetId)) return widget

        if (!nextSlotName) {
            return mergeWidgetUpdate(widget, updatedWidget)
        }

        const childWidgets = widget.config?.slots?.[nextSlotName] || []
        const updatedChildWidgets = updateNestedWidgetAtPath(childWidgets, restPath, updatedWidget)

        return {
            ...widget,
            config: {
                ...(widget.config || {}),
                slots: {
                    ...(widget.config?.slots || {}),
                    [nextSlotName]: updatedChildWidgets
                }
            }
        }
    })
}

export const applyWidgetUpdateToWidgetMap = (widgets = {}, updatedWidget) => {
    if (!updatedWidget?.id) return widgets

    const widgetPath = updatedWidget.widgetPath || updatedWidget.context?.widgetPath
    const pathParts = Array.isArray(widgetPath) ? widgetPath : []

    if (pathParts.length >= 2) {
        const [topSlotName, ...nestedPath] = pathParts
        return {
            ...widgets,
            [topSlotName]: updateNestedWidgetAtPath(widgets[topSlotName] || [], nestedPath, updatedWidget)
        }
    }

    const slotName = updatedWidget.slotName || updatedWidget.slot || updatedWidget.context?.slotName
    if (!slotName) return widgets

    const slotWidgets = widgets[slotName] || []

    return {
        ...widgets,
        [slotName]: slotWidgets.map(widget =>
            String(widget.id) === String(updatedWidget.id)
                ? mergeWidgetUpdate(widget, updatedWidget)
                : widget
        )
    }
}
