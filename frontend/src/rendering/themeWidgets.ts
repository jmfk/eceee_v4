import DOMPurify from 'isomorphic-dompurify'
import { imageUrl } from './primitives'

// Match the bounded theme-widget HTML policy in webpages.theme_widgets.
export const sanitizeThemeWidgetHtml = (html: string) => String(DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'abbr', 'acronym', 'b', 'blockquote', 'code', 'em', 'i', 'li', 'ol', 'strong', 'ul',
        'div', 'span', 'p', 'article', 'section', 'header', 'footer', 'aside', 'figure', 'figcaption',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['class', 'id', 'title', 'alt', 'src', 'href', 'target', 'rel', 'loading', 'width', 'height', 'role'],
    ALLOW_DATA_ATTR: false,
})).replace(/\s(?:src|href)="data:[^"]*"/gi, '')

export interface ThemeWidgetRelease {
    version: number
    schema: { type: string; properties: Record<string, any>; required?: string[] }
    template: string
    css: string
    compiled_css: string
    defaults: Record<string, any>
}

export interface ThemeWidgetType {
    id: string
    name: string
    description?: string
    status?: 'active' | 'archived'
    active_version: number
    releases: ThemeWidgetRelease[]
    working?: Partial<ThemeWidgetRelease>
}

export interface ThemeWidgetDocument { version: number; items: ThemeWidgetType[] }

export const emptyThemeWidgets = (): ThemeWidgetDocument => ({ version: 1, items: [] })
export const isThemeWidget = (type?: string) => Boolean(type?.startsWith('theme_widgets.'))
export const themeWidgetDocument = (theme: any): ThemeWidgetDocument => theme?.widgetTypes || theme?.widget_types || emptyThemeWidgets()
export const findThemeWidget = (document: ThemeWidgetDocument | undefined, type: string, version: number | undefined) => {
    const item = document?.items?.find(candidate => `theme_widgets.${candidate.id}` === type)
    const release = Number.isInteger(version) ? item?.releases?.find(candidate => candidate.version === version) : undefined
    return item && release ? { item, release } : null
}
export const themeWidgetTypes = (document: ThemeWidgetDocument) => document.items.flatMap(item => {
    const release = item.releases.find(candidate => candidate.version === item.active_version)
    return item.status !== 'archived' && release ? [{
        type: `theme_widgets.${item.id}`, name: item.name, description: item.description || '',
        isActive: true, typeVersion: release.version, latestVersion: item.active_version,
        defaultConfig: release.defaults, defaults: release.defaults, schema: release.schema,
        configurationSchema: release.schema, category: 'theme',
    }] : []
})

// Keep the existing visual schema editor, with a bounded widget field contract.
export const normalizeAuthoredWidgetSchema = (schema: any) => ({
    ...schema,
    properties: Object.fromEntries(Object.entries(schema.properties || {}).map(([name, candidate]) => {
        const field = candidate as Record<string, any>
        const allowed = new Set(['type', 'title', 'description', 'default', 'format', 'enum', 'minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'fieldType', 'placeholder'])
        const value = Object.fromEntries(Object.entries(field).filter(([key]) => allowed.has(key)))
        const kind = field.fieldType || 'text'
        value.controlType = kind
        if (kind === 'rich_text') value.format = 'rich-text'
        if (kind === 'textarea') value.format = 'textarea'
        if (kind === 'url') value.format = 'uri'
        if (kind === 'image') Object.assign(value, { type: ['object', 'null'], format: 'media', default: field.default && typeof field.default === 'object' ? field.default : null })
        if (kind === 'choice') {
            value.enum = field.enum || ['Option 1', 'Option 2']
            if (!value.enum.includes(value.default)) value.default = value.enum[0]
        }
        return [name, value]
    })),
})

export const themeWidgetData = (release: ThemeWidgetRelease, config: Record<string, any>) => Object.fromEntries(
    Object.entries(release.schema.properties).map(([key, field]) => {
        let value = config[key] ?? field.default ?? ''
        if (field.format === 'rich-text' || field.fieldType === 'rich_text') value = sanitizeThemeWidgetHtml(String(value))
        if (field.format === 'media') value = value ? { ...value, url: imageUrl(value), alt: value.alt || value.altText || value.alt_text || '' } : null
        return [key, value]
    }),
)
