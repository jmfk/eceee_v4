import manifest from '../../rendering/generated/render-manifest.json'
import { themeWidgetTypes } from '../../rendering/themeWidgets'
import { EASY_WIDGET_REGISTRY } from '../../widgets/easy-widgets'

const objectDescriptions = {
    'object_storage.ObjectChildrenWidget': 'Show the child objects of the current object.',
    'object_storage.ObjectDetailWidget': 'Show the content and fields of one object.',
    'object_storage.ObjectListWidget': 'List objects matching the selected types and filters.',
}

export const slotWidgetTypeOptions = (workspace) => [
    { value: '*', label: 'All widget types', description: 'Any current or future widget type.' },
    { value: 'easy_widgets.*', label: 'All built-in EASY widgets', description: 'All standard content, navigation and layout widgets.' },
    { value: 'object_storage.*', label: 'All object widgets', description: 'Object lists, details and child objects.' },
    { value: 'theme_widgets.*', label: 'All theme widgets', description: 'Widgets published in this theme.' },
    ...Object.entries(manifest.widgets).map(([value, metadata]) => {
        const editor = EASY_WIDGET_REGISTRY[value]?.metadata
        return { value, label: editor?.name || metadata.name, description: editor?.description || objectDescriptions[value] || 'Content widget.' }
    }),
    ...themeWidgetTypes(workspace.widgetTypes || workspace.themeConfig?.widgetTypes || workspace.themeConfig?.widget_types || { version: 1, items: [] })
        .map(widget => ({ value: widget.type, label: widget.name, description: widget.description || 'Custom widget published in this theme.' })),
]
