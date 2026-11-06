type Schema = Record<string, any>

export const newsHomeEditorSchema = (widgetType: string, source: Schema | null): Schema | null => {
    if (!source || !['easy_widgets.NewsFlashWidget', 'easy_widgets.TopNewsPlugWidget', 'easy_widgets.SidebarTopNewsWidget'].includes(widgetType)) return source
    const definition = source.schema || source
    if (!definition.properties) return source
    const properties = { ...definition.properties }
    properties.newsPagePath = {
        type: 'string', title: 'News page path', default: '/news/',
        description: 'Path to the news detail page, for example /news/.',
        component: 'TextInput', group: 'Content',
    }
    if (widgetType === 'easy_widgets.NewsFlashWidget') {
        delete properties.limit
        properties.imageShape = {
            type: 'string', title: 'Image shape', default: 'landscape', group: 'Layout', component: 'SelectInput',
            options: [{ value: 'square', label: 'Square (1:1)' }, { value: 'landscape', label: 'Landscape (7:4)' }],
        }
        for (const [key, title, fallback] of [
            ['fullWidthCount', 'Full-width stories', 1], ['halfWidthCount', 'Half-width stories', 2], ['thirdWidthCount', 'Third-width stories', 0],
        ] as const) properties[key] = { type: 'integer', title, default: fallback, minimum: 0, component: 'NumberInput', min: 0, step: 1, group: 'Layout' }
    } else if (widgetType === 'easy_widgets.TopNewsPlugWidget') {
        properties.layout = {
            ...properties.layout,
            default: '1x2',
            options: [
                { value: '1x2', label: 'Two columns' },
                { value: '1x3', label: 'Three columns' },
            ],
        }
    } else {
        properties.displayVariant = {
            type: 'string', title: 'Placement', default: 'content',
            component: 'RadioInput', group: 'Layout',
            options: [
                { value: 'content', label: 'Page content' },
                { value: 'header', label: 'Header' },
            ],
        }
    }
    return source.schema
        ? { ...source, schema: { ...definition, properties } }
        : { ...source, properties }
}
