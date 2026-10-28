type Schema = Record<string, any>

export const newsHomeEditorSchema = (widgetType: string, source: Schema | null): Schema | null => {
    if (!source || !['easy_widgets.TopNewsPlugWidget', 'easy_widgets.SidebarTopNewsWidget'].includes(widgetType)) return source
    const definition = source.schema || source
    if (!definition.properties) return source
    const properties = { ...definition.properties }
    properties.newsPagePath = {
        type: 'string', title: 'News page path', default: '/news/',
        description: 'Path to the news detail page, for example /news/.',
        component: 'TextInput', group: 'Content',
    }
    if (widgetType === 'easy_widgets.TopNewsPlugWidget') {
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
