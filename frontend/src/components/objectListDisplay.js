export const DEFAULT_LIST_FIELDS = ['status', 'created_at', 'publish_date']

const SYSTEM_FIELDS = {
    created_at: ['Created', 'createdAt'],
    updated_at: ['Updated', 'updatedAt'],
    publish_date: ['Publish', 'publishDate'],
    unpublish_date: ['Unpublish', 'unpublishDate'],
}

const displayDate = value => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-')
        return `${day}/${month}/${year}`
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}

export const listFieldsFor = definition => definition?.browserConfig?.listFields ?? DEFAULT_LIST_FIELDS

export const listDetail = (instance, definition, key) => {
    if (key === 'status') return null
    if (SYSTEM_FIELDS[key]) {
        const [label, property] = SYSTEM_FIELDS[key]
        const value = instance[property]
        return value ? { key, label, value: displayDate(value) } : null
    }
    if (!key.startsWith('field:')) return null
    const fieldKey = key.slice(6)
    const camelKey = fieldKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    const value = instance.data?.[fieldKey] ?? instance.data?.[camelKey]
    if (value === null || value === undefined || value === '' || typeof value === 'object') return null
    const field = definition?.schema?.properties?.[fieldKey] || definition?.schema?.properties?.[camelKey] || {}
    const component = field.componentType || field.field_type || field.type
    const formatted = typeof value === 'boolean' ? (value ? 'Yes' : 'No')
        : ['date', 'datetime', 'datetime-local'].includes(component) ? displayDate(value) : String(value)
    return { key, label: field.title || fieldKey, value: formatted }
}
