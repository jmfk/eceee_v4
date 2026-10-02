export function generateWidgetId() {
    const value = globalThis.crypto?.randomUUID?.()
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return `widget-${value}`
}

export function regenerateWidgetIds(widget) {
    const copy = { ...widget, id: generateWidgetId() }
    if (!copy.config?.slots) return copy

    copy.config = { ...copy.config, slots: { ...copy.config.slots } }
    for (const [slotName, widgets] of Object.entries(copy.config.slots)) {
        if (Array.isArray(widgets)) {
            copy.config.slots[slotName] = widgets.map(regenerateWidgetIds)
        }
    }
    return copy
}
