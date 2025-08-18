import { describe, it, expect } from 'vitest'
import { DEFAULT_SCHEMA_FIELDS, validateFieldName, validateSchemaShape } from '../../utils/schemaValidation'

describe('schemaValidation helpers', () => {
    it('validateFieldName enforces camelCase pattern', () => {
        // Valid camelCase
        expect(validateFieldName('title')).toBe(true)
        expect(validateFieldName('firstName')).toBe(true)
        expect(validateFieldName('myCustomField')).toBe(true)
        expect(validateFieldName('field123')).toBe(true)

        // Invalid - PascalCase
        expect(validateFieldName('Title')).toBe(false)
        expect(validateFieldName('FirstName')).toBe(false)

        // Invalid - snake_case
        expect(validateFieldName('first_name')).toBe(false)
        expect(validateFieldName('_name1')).toBe(false)

        // Invalid - kebab-case
        expect(validateFieldName('first-name')).toBe(false)
        expect(validateFieldName('bad-name')).toBe(false)

        // Invalid - starts with number
        expect(validateFieldName('1bad')).toBe(false)

        // Invalid - consecutive uppercase
        expect(validateFieldName('myHTMLField')).toBe(false)
        expect(validateFieldName('XMLParser')).toBe(false)
    })

    it('DEFAULT_SCHEMA_FIELDS contains expected default fields', () => {
        expect(DEFAULT_SCHEMA_FIELDS.metaTitle).toBeDefined()
        expect(DEFAULT_SCHEMA_FIELDS.metaDescription).toBeDefined()
        expect(DEFAULT_SCHEMA_FIELDS.featuredImage).toBeDefined()
    })

    it('validateSchemaShape validates structure', () => {
        expect(validateSchemaShape({ type: 'object', properties: {} }).valid).toBe(true)
        expect(validateSchemaShape({ type: 'array' }).valid).toBe(false)
        expect(validateSchemaShape({ type: 'object', properties: [], required: 'nope' }).valid).toBe(false)
    })
})


