function hashString(str) {
    let hash = 0
    const value = String(str || '')
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(index)
        hash |= 0
    }
    return Math.abs(hash).toString(36)
}

function mapFieldToTarget(field) {
    if (!field) return { type: 'data' }
    const settingsFields = new Set(['title', 'slug', 'codeLayout'])
    const metadataFields = new Set(['metaTitle', 'metaDescription', 'hostnames'])
    if (settingsFields.has(field)) return { type: 'settings' }
    if (metadataFields.has(field)) return { type: 'metadata' }
    return { type: 'data' }
}

export function deriveTodoItemsFromError(errorString) {
    const items = []
    const message = String(errorString || '')

    if (/\btheme:\s*Invalid pk\b.*object does not exist/i.test(message)) {
        return [{
            id: `invalid-theme:${hashString(message)}`,
            title: 'Selected theme is no longer available',
            detail: message,
            hint: 'Open Page Settings → Page Theme, then choose an available theme or Use system default.',
            target: { type: 'settings' },
            checked: false,
        }]
    }

    // Common jsonschema error patterns
    const requiredMatch = message.match(/'(.*?)' is a required property/)
    if (requiredMatch) {
        const field = requiredMatch[1]
        const target = mapFieldToTarget(field)
        items.push({
            id: `required:${field}`,
            title: `Missing required field: ${field}`,
            detail: message,
            hint: `Provide a valid value for '${field}'.`,
            target,
            checked: false,
        })
    }

    const typeMatch = message.match(/'(.*?)' is not of type '(.*?)'/)
    if (typeMatch) {
        const field = typeMatch[1]
        const expected = typeMatch[2]
        const target = mapFieldToTarget(field)
        items.push({
            id: `type:${field}`,
            title: `Field '${field}' must be of type ${expected}`,
            detail: message,
            hint: `Change the value of '${field}' to a ${expected}.`,
            target,
            checked: false,
        })
    }

    // Fallback single item if nothing matched
    if (items.length === 0) {
        items.push({
            id: `error:${hashString(message)}`,
            title: 'Validation error',
            detail: message,
            hint: 'Review the error and update the related fields.',
            target: { type: 'data', path: null },
            checked: false,
        })
    }
    return items
}
