/** Framework-independent built-in contracts. No Django, database or npm dependencies. */
import { readFileSync } from 'node:fs'

function document(name) {
    const value = JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'))
    if (value.formatVersion !== 1) throw new Error(`Unsupported widget contract version: ${name}`)
    return value
}
const catalog = document('./render_catalog.json')
const definitions = document('./pilot_models.json')
const clone = value => structuredClone(value)
const supportedFieldKeys = new Set(['name', 'alias', 'annotation', 'api_type', 'description', 'schema_title', 'default', 'ui', 'min_length'])
function checkAnnotation(spec) {
    if (Object.keys(spec).length !== 1) throw new Error('Unsupported pilot annotation shape')
    if (spec.nullable || spec.list || spec.dict) return checkAnnotation(spec.nullable || spec.list || spec.dict)
    if (spec.model && Object.hasOwn(definitions.models, spec.model)) return
    if (spec.literal?.length && spec.literal.every(value => typeof value === 'string')) return
    if (['str', 'bool', 'dict', 'any'].includes(spec.type)) return
    throw new Error('Unsupported pilot annotation')
}
for (const model of Object.values(definitions.models)) {
    for (const field of model.fields) {
        if (Object.keys(field).some(key => !supportedFieldKeys.has(key))) throw new Error(`Unsupported pilot field constraint: ${field.name}`)
        checkAnnotation(field.annotation)
    }
}
export const pilotTypes = Object.freeze(Object.keys(definitions.widgets))
export function renderMetadata(typeId) { return clone(catalog.widgets[typeId]) }
export function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    return value
}
export function buildRenderManifest() {
    const widgets = Object.fromEntries(Object.entries(catalog.widgets).map(([typeId, entry]) => [typeId, {
        name: entry.name, css: entry.css, cssVariables: clone(entry.cssVariables),
        layoutParts: Object.fromEntries(Object.entries(entry.layoutParts).map(([id, part]) => [id, {
            selector: part?.selector ?? null, relationship: part?.relationship ?? 'auto',
        }])),
        variants: clone(entry.variants).sort((a, b) => {
            for (const key of ['id', 'type']) {
                if ((a[key] || '') < (b[key] || '')) return -1
                if ((a[key] || '') > (b[key] || '')) return 1
            }
            return 0
        }),
    }]))
    return canonical({ formatVersion: catalog.manifestVersion, defaultSpecialPages: clone(catalog.defaultSpecialPages), widgets })
}
export function serializeManifest() { return JSON.stringify(buildRenderManifest(), null, 2) + '\n' }

function modelName(typeId) {
    const name = definitions.widgets[typeId]
    if (!name) throw new Error(`Not a pilot widget: ${typeId}`)
    return name
}
function schemaAnnotation(annotation, refs) {
    if (annotation.nullable) return { anyOf: [schemaAnnotation(annotation.nullable, refs), { type: 'null' }] }
    if (annotation.literal) return { enum: clone(annotation.literal), type: 'string' }
    if (annotation.list) return { items: schemaAnnotation(annotation.list, refs), type: 'array' }
    if (annotation.dict) return { additionalProperties: schemaAnnotation(annotation.dict, refs).type ? schemaAnnotation(annotation.dict, refs) : true, type: 'object' }
    if (annotation.model) {
        refs.add(annotation.model)
        return { $ref: `#/$defs/${annotation.model}` }
    }
    return { str: { type: 'string' }, bool: { type: 'boolean' }, dict: { additionalProperties: true, type: 'object' }, any: {} }[annotation.type]
}
function schemaModel(name, refs) {
    const model = definitions.models[name]
    const properties = {}
    const required = []
    for (const field of model.fields) {
        const prop = { ...schemaAnnotation(field.annotation, refs), ...clone(field.ui || {}), description: field.description, title: field.schema_title }
        if (Object.hasOwn(field, 'default')) prop.default = clone(field.default)
        else required.push(field.alias)
        if (Object.hasOwn(field, 'min_length')) prop[field.annotation.list ? 'minItems' : 'minLength'] = field.min_length
        if (Object.hasOwn(field, 'max_length')) prop[field.annotation.list ? 'maxItems' : 'maxLength'] = field.max_length
        properties[field.alias] = prop
    }
    return { description: model.description, properties, ...(required.length ? { required } : {}), title: name, type: 'object' }
}
export function configurationSchema(typeId) {
    const refs = new Set()
    const schema = schemaModel(modelName(typeId), refs)
    const defs = {}
    for (const name of refs) defs[name] = schemaModel(name, refs)
    if (refs.size) schema.$defs = defs
    return schema
}
export function configurationDefaults(typeId) {
    return Object.fromEntries(definitions.models[modelName(typeId)].fields
        .filter(field => Object.hasOwn(field, 'default') && field.default !== null)
        .map(field => [field.name, clone(field.default)]))
}
export function configurationUiSchema(typeId) {
    const model = definitions.models[modelName(typeId)]
    const schema = configurationSchema(typeId)
    const fields = Object.fromEntries(model.fields.map(field => {
        const property = schema.properties[field.alias]
        const metadata = {
            name: field.name, type: field.api_type, required: !Object.hasOwn(field, 'default'),
            default: clone(field.default ?? null), description: field.description,
        }
        if (field.ui) metadata.ui = clone(field.ui)
        for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'enum', 'minItems', 'maxItems', 'items']) {
            // Match the existing view: constraint lookup uses the Python field name.
            if (schema.properties[field.name] && Object.hasOwn(property, key)) metadata[key] = clone(property[key])
        }
        return [field.name, metadata]
    }))
    return {
        widget_type: typeId, widget_name: catalog.widgets[typeId].name,
        schema, fields, defaults: configurationDefaults(typeId), required: schema.required || [],
        variants: clone(catalog.widgets[typeId].variants),
    }
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const error = (type, loc, msg, input, ctx) => ({
    type, loc, msg, input, ...(ctx ? { ctx } : {}), url: `https://errors.pydantic.dev/2.14/v/${type}`,
})
const quoted = value => `'${value}'`
function expectedLiterals(values) {
    const parts = values.map(quoted)
    return parts.length === 2 ? parts.join(' or ') : `${parts.slice(0, -1).join(', ')} or ${parts.at(-1)}`
}
function validateValue(spec, value, loc, errors) {
    if (spec.nullable) return value === null ? null : validateValue(spec.nullable, value, loc, errors)
    if (spec.literal) {
        if (spec.literal.includes(value)) return value
        const expected = expectedLiterals(spec.literal)
        errors.push(error('literal_error', loc, `Input should be ${expected}`, value, { expected }))
    } else if (spec.list) {
        if (!Array.isArray(value)) errors.push(error('list_type', loc, 'Input should be a valid list', value))
        else return value.map((item, index) => validateValue(spec.list, item, [...loc, index], errors))
    } else if (spec.model) {
        if (!isObject(value)) errors.push(error('model_type', loc, `Input should be a valid dictionary or instance of ${spec.model}`, value, { class_name: spec.model }))
        else return validateModel(spec.model, value, errors, loc)
    } else if (spec.dict || spec.type === 'dict') {
        if (!isObject(value)) errors.push(error('dict_type', loc, 'Input should be a valid dictionary', value))
        else return clone(value)
    } else if (spec.type === 'str') {
        if (typeof value === 'string') return value
        errors.push(error('string_type', loc, 'Input should be a valid string', value))
    } else if (spec.type === 'bool') {
        if (typeof value === 'boolean') return value
        if (value === 0 || value === 1) return Boolean(value)
        if (typeof value === 'string') {
            const normalized = value.toLowerCase()
            if (['0', 'off', 'f', 'false', 'n', 'no'].includes(normalized)) return false
            if (['1', 'on', 't', 'true', 'y', 'yes'].includes(normalized)) return true
            errors.push(error('bool_parsing', loc, 'Input should be a valid boolean, unable to interpret input', value))
        } else if (Number.isInteger(value)) errors.push(error('bool_parsing', loc, 'Input should be a valid boolean, unable to interpret input', value))
        else errors.push(error('bool_type', loc, 'Input should be a valid boolean', value))
    } else if (spec.type === 'any') return clone(value)
    else throw new Error('Unsupported pilot annotation')
    return undefined
}
function validateModel(name, input, errors, prefix = []) {
    const result = {}
    for (const field of definitions.models[name].fields) {
        const key = Object.hasOwn(input, field.alias) ? field.alias : field.name
        const loc = [...prefix, Object.hasOwn(input, key) ? key : field.alias]
        if (!Object.hasOwn(input, key)) {
            if (Object.hasOwn(field, 'default')) result[field.name] = clone(field.default)
            else errors.push(error('missing', loc, 'Field required', input))
            continue
        }
        const previous = errors.length
        const value = validateValue(field.annotation, input[key], loc, errors)
        if (errors.length !== previous) continue
        if (Object.hasOwn(field, 'min_length') && (typeof value === 'string' ? [...value].length : value.length) < field.min_length) {
            const limit = field.min_length
            if (typeof value === 'string') errors.push(error('string_too_short', loc, `String should have at least ${limit} character${limit === 1 ? '' : 's'}`, input[key], { min_length: limit }))
            else errors.push(error('too_short', loc, `List should have at least ${limit} item${limit === 1 ? '' : 's'} after validation, not ${value.length}`, input[key], { field_type: 'List', min_length: limit, actual_length: value.length }))
        }
        result[field.name] = value
    }
    return result
}
/** Direct model validation. Wire casing and permissions belong to the transport adapter. */
export function validateConfiguration(typeId, input) {
    if (!isObject(input)) throw new TypeError('Widget configuration must be an object')
    const errors = []
    const value = validateModel(modelName(typeId), input, errors)
    if (errors.length) return { valid: false, errors }
    return { valid: true, value }
}
