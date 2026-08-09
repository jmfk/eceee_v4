const fieldSourceMarkers = ['-field-']
const fieldSourcePrefixes = ['field-']
// LEGACY compatibility: these source IDs are still produced by older widget prop paths.
// Active editor callers should use the adapter helpers instead of matching them inline.
const legacyWidgetSourcePrefixes = [
    'bannerwidget-',
    'two-columns-widget-',
    'three-columns-widget-',
    'section-widget-',
    'contentcardwidget-',
    'widget-'
]

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

const setNestedValue = (object, path, value) => {
    const keys = path.split('.')
    const result = { ...(object || {}) }
    let current = result

    for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index]
        current[key] = isObject(current[key]) ? { ...current[key] } : {}
        current = current[key]
    }

    current[keys[keys.length - 1]] = value
    return result
}

export const createActiveWidgetPropContext = ({
    widgetData = {},
    context = {},
    widgetId,
    slotName,
    contextType,
    pageId,
    versionId,
    componentId
} = {}) => ({
    widgetId: widgetId || context?.widgetId || widgetData?.id,
    slotName: slotName || context?.slotName || widgetData?.slotName || widgetData?.slot,
    contextType: contextType || context?.contextType || widgetData?.context?.contextType,
    pageId: pageId || context?.pageId || widgetData?.context?.pageId,
    versionId: versionId || context?.versionId || widgetData?.context?.versionId,
    widgetPath: context?.widgetPath || widgetData?.widgetPath || widgetData?.context?.widgetPath,
    componentId
})

export const buildWidgetPropUpdate = ({
    currentWidgetData,
    propContext,
    fieldName,
    value,
    activeVariants
}) => {
    const widgetId = propContext?.widgetId || currentWidgetData?.id
    const slotName = propContext?.slotName || currentWidgetData?.slotName || currentWidgetData?.slot
    const contextType = propContext?.contextType
    const widgetPath = propContext?.widgetPath
    const componentId = propContext?.componentId || `isolated-form-${widgetId || 'preview'}`
    const fieldSourceId = `${componentId}-field-${fieldName}`
    const configPatch = { [fieldName]: value }
    const widgetUpdates = activeVariants ? { activeVariants } : undefined

    const updatedWidget = {
        ...currentWidgetData,
        id: widgetId,
        config: {
            ...(currentWidgetData?.config || {}),
            ...configPatch
        },
        ...(widgetUpdates ? { widgetUpdates } : {}),
        ...(slotName ? { slotName } : {}),
        context: {
            ...(currentWidgetData?.context || {}),
            ...(propContext || {}),
            widgetId,
            slotName,
            contextType
        }
    }

    const udcPayload = {
        id: widgetId,
        slotName,
        contextType,
        pageId: propContext?.pageId,
        versionId: propContext?.versionId,
        config: configPatch,
        ...(widgetUpdates ? { widgetUpdates } : {}),
        ...(widgetPath && widgetPath.length > 0 ? { widgetPath } : {})
    }

    return {
        fieldPath: `config.${fieldName}`,
        fieldSourceId,
        isDirty: true,
        configPatch,
        updatedWidget,
        udcPayload
    }
}

export const applyWidgetPropUpdates = (widgetData, updates = []) =>
    updates.reduce((currentWidget, { fieldName, value }) => ({
        ...currentWidget,
        config: setNestedValue(currentWidget?.config || {}, fieldName, value)
    }), widgetData)

export const countConfigChangedFields = (previousConfig = {}, nextConfig = {}) => {
    const allKeys = new Set([...Object.keys(nextConfig || {}), ...Object.keys(previousConfig || {})])
    return Array.from(allKeys).filter(key =>
        JSON.stringify(nextConfig?.[key]) !== JSON.stringify(previousConfig?.[key])
    )
}

export const isFieldLevelPropSource = sourceId =>
    fieldSourcePrefixes.some(prefix => sourceId.startsWith(prefix)) ||
    fieldSourceMarkers.some(marker => sourceId.includes(marker))

export const isLegacyWidgetPropSource = sourceId =>
    legacyWidgetSourcePrefixes.some(prefix => sourceId.startsWith(prefix)) ||
    /^[a-z-]+widget-\d+/.test(sourceId)

export const shouldHydrateExternalWidgetProps = ({
    sourceId = '',
    changedFields = []
} = {}) => {
    if (isFieldLevelPropSource(sourceId)) return false
    if (sourceId === 'udc-save-current-version') return false
    if (isLegacyWidgetPropSource(sourceId) && changedFields.length === 1) return false
    return true
}

export const createPageWidgetConfigChangeHandler = ({
    onConfigChange,
    widget,
    slotName
}) => {
    if (!onConfigChange) return undefined

    return newConfig => {
        if (onConfigChange.length === 1) {
            onConfigChange(newConfig)
            return
        }

        onConfigChange(widget?.id, slotName, newConfig)
    }
}
