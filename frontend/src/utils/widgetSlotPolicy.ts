type SlotPolicy = {
    allowed_widget_types?: string[]
    allowedWidgetTypes?: string[]
    disallowed_widget_types?: string[]
    disallowedWidgetTypes?: string[]
    max_widgets?: number | null
    maxWidgets?: number | null
}

const matches = (type: string, patterns: string[]) => patterns.some((pattern) =>
    pattern === '*' || pattern === type || (pattern.endsWith('.*') && type.startsWith(pattern.slice(0, -1)))
)

export const isWidgetAllowedInSlot = (type: string, policy: SlotPolicy = {}) => {
    const allowed = policy.allowed_widget_types || policy.allowedWidgetTypes || []
    const disallowed = policy.disallowed_widget_types || policy.disallowedWidgetTypes || []
    return (!allowed.length || matches(type, allowed)) && !matches(type, disallowed)
}

export const visibleSlotWidgets = <T extends { type: string, config?: Record<string, unknown> }>(widgets: T[], policy: SlotPolicy = {}): T[] => {
    const allowed = widgets.filter((widget) => isWidgetAllowedInSlot(widget.type, policy) &&
        widget.config?.is_visible !== false && widget.config?.isVisible !== false &&
        widget.config?.is_active !== false && widget.config?.isActive !== false)
    const maximum = policy.max_widgets ?? policy.maxWidgets
    return maximum == null ? allowed : allowed.slice(0, maximum)
}
