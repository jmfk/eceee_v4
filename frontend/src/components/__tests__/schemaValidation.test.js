import { describe, it, expect } from 'vitest'
import { DEFAULT_SCHEMA_FIELDS, isDefaultField, validateFieldName, validateSchemaShape, mergeWithDefaults, getSchemaWithoutDefaults } from '../../utils/schemaValidation'

describe('schemaValidation helpers', () => {
    it('validateFieldName enforces correct pattern', () => {
        expect(validateFieldName('title')).toBe(true)
        expect(validateFieldName('_name1')).toBe(true)
        expect(validateFieldName('1bad')).toBe(false)
        expect(validateFieldName('bad-name')).toBe(false)
    })

    it('isDefaultField matches DEFAULT_SCHEMA_FIELDS', () => {
        for (const key of Object.keys(DEFAULT_SCHEMA_FIELDS)) {
            expect(isDefaultField(key)).toBe(true)
        }
        expect(isDefaultField('custom')).toBe(false)
    })

    it('validateSchemaShape validates structure', () => {
        expect(validateSchemaShape({ type: 'object', properties: {} }).valid).toBe(true)
        expect(validateSchemaShape({ type: 'array' }).valid).toBe(false)
        expect(validateSchemaShape({ type: 'object', properties: [], required: 'nope' }).valid).toBe(false)
    })

    it('mergeWithDefaults includes defaults and filters required', () => {
        const schema = { type: 'object', properties: { custom: { type: 'string' } }, required: ['title', 'custom', 'description'] }
        const merged = mergeWithDefaults(schema)
        expect(merged.properties.title).toBeDefined()
        expect(merged.properties.description).toBeDefined()
        expect(merged.properties.custom).toBeDefined()
        expect(merged.required).toContain('title')
        expect(merged.required).toContain('custom')
        expect(merged.required).not.toContain('description')
    })

    it('getSchemaWithoutDefaults strips default fields', () => {
        const src = { type: 'object', properties: { title: { type: 'string' }, custom: { type: 'number' } }, required: ['title', 'custom'] }
        const without = getSchemaWithoutDefaults(src)
        expect(without.properties.title).toBeUndefined()
        expect(without.properties.custom).toBeDefined()
        expect(without.required).toEqual(['custom'])
    })
})


