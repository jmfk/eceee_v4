/** Compatibility adapter for the existing widget metadata API's JSON boundary.
 * Not an HTTP server: authentication/tenant enforcement stays in Django.
 */
import { buildRenderManifest, configurationSchema, configurationDefaults, configurationUiSchema, renderMetadata, pilotTypes, validateConfiguration } from './index.mjs'

const ignored = new Set(['text_outline_styles', 'textOutlineStyles'])
function convert(value, keyConverter) {
    if (Array.isArray(value)) return value.map(item => convert(item, keyConverter))
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        const next = keyConverter(key)
        return [next, ignored.has(key) || ignored.has(next) ? item : convert(item, keyConverter)]
    }))
    return value
}
export const parseWire = value => convert(value, key => key.replace(/([a-z0-9]|[A-Z]?(?=[A-Z](?=[a-z])))([A-Z])/g, '$1_$2').toLowerCase())
export const renderWire = value => convert(value, key => key.replace(/[a-z0-9]?_[a-z0-9]/g, group => group.length === 3 ? group[0] + group[2].toUpperCase() : group[1].toUpperCase()))

function formattedErrors(errors) {
    const entries = new Map()
    for (const error of errors) {
        const field = error.loc[0] ?? 'root'
        let message = error.msg
        if (error.type === 'missing') message = 'This field is required'
        if (error.type === 'string_too_short') message = `Must be at least ${error.ctx?.limit_value ?? 'specified'} characters long`
        if (error.type === 'string_too_long') message = `Must be no more than ${error.ctx?.limit_value ?? 'specified'} characters long`
        if (!entries.has(field)) entries.set(field, [])
        entries.get(field).push(message)
    }
    return Object.fromEntries(entries)
}
const truthy = value => Boolean(value) && !(Array.isArray(value) && value.length === 0) && !(value && typeof value === 'object' && Object.keys(value).length === 0)
export function observeRequest(request) {
    // Anonymous fixture inputs describe the existing policy; they are not evidence
    // of server-side authentication. Real permission tests run through Django.
    if (request.anonymous) return { status: 403, body: { detail: 'You do not have permission to perform this action.' } }
    const match = /^\/api\/v1\/webpages\/widget-types\/([^/]+)\/(schema|configuration-defaults|config-ui-schema|validate)\/$/.exec(request.path.split('?')[0])
    if (!match) throw new Error(`Unsupported pilot route: ${request.path}`)
    const [, lookup, action] = match
    const typeId = pilotTypes.find(type => type === lookup || renderMetadata(type).name === lookup || renderMetadata(type).name.toLowerCase().replace(/\s+/g, '-') === lookup)
    if (!typeId) return { status: 404, body: { error: `Widget type '${lookup}' not found` } }
    const requiredMethod = action === 'validate' ? 'POST' : 'GET'
    if (request.method !== requiredMethod) throw new Error(`Unsupported pilot method: ${request.method}`)
    let body
    if (action === 'schema') body = { widget_type: renderMetadata(typeId).name, schema: configurationSchema(typeId) }
    if (action === 'configuration-defaults') body = { defaults: configurationDefaults(typeId), schema: configurationSchema(typeId) }
    if (action === 'config-ui-schema') body = configurationUiSchema(typeId)
    if (action === 'validate') {
        const data = parseWire(request.body || {})
        const config = truthy(data.widget_data) ? data.widget_data : (data.configuration ?? {})
        const validated = validateConfiguration(typeId, config)
        body = validated.valid
            ? { is_valid: true, errors: {}, warnings: {}, validated_data: validated.value }
            : { is_valid: false, errors: formattedErrors(validated.errors), warnings: {}, raw_errors: validated.errors }
    }
    return { status: 200, body: renderWire(body) }
}
export { buildRenderManifest }
