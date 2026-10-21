import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildRenderManifest, configurationSchema, configurationDefaults, configurationUiSchema, renderMetadata, validateConfiguration } from '../index.mjs'
import { parseWire, renderWire, observeRequest } from '../transport.mjs'

const type = name => `easy_widgets.${name}Widget`
const form = { title: 'Another form', fields: [{ name: 'email', label: 'Email', type: 'email' }] }

test('the complete manifest is deterministic, has 25 built-ins, and returns independent values', () => {
    const first = buildRenderManifest()
    assert.equal(first.formatVersion, 2)
    assert.equal(Object.keys(first.widgets).length, 25)
    assert.deepEqual(first.defaultSpecialPages.map(page => page.status_code), [403, 404, 500, 503])
    assert.ok(first.widgets['object_storage.ObjectDetailWidget'])
    assert.match(first.widgets[type('TwoColumns')].css, /grid-template-columns: 2fr 1fr/)
    first.widgets[type('Headline')].css = 'mutated'
    first.defaultSpecialPages[0].widgets = {}
    assert.notDeepEqual(first, buildRenderManifest())
})

test('manifest CLI detects drift instead of updating in check mode', () => {
    const directory = mkdtempSync(join(tmpdir(), 'widget-catalog-test-'))
    const output = join(directory, 'manifest.json')
    const script = new URL('../manifest.mjs', import.meta.url)
    try {
        assert.equal(spawnSync(process.execPath, [script.pathname, '--output', output]).status, 0)
        assert.equal(spawnSync(process.execPath, [script.pathname, '--check', '--output', output]).status, 0)
        writeFileSync(output, '{}\n')
        assert.notEqual(spawnSync(process.execPath, [script.pathname, '--check', '--output', output]).status, 0)
        assert.equal(readFileSync(output, 'utf8'), '{}\n')
    } finally { rmSync(directory, { recursive: true }) }
})

test('pilot metadata keeps nested form schema, defaults and field UI', () => {
    const schema = configurationSchema(type('Forms'))
    assert.deepEqual(schema.required, ['title', 'fields'])
    assert.equal(schema.$defs.FormField.properties.name.minLength, 1)
    assert.equal(schema.properties.fields.minItems, 1)
    assert.equal(schema.properties.fields.items.$ref, '#/$defs/FormField')
    assert.equal(configurationUiSchema(type('Banner')).fields.text_outline.ui.component, 'TextOutlineSelect')
    assert.equal(configurationUiSchema(type('Forms')).fields.fields.type, 'List')
    assert.equal(configurationDefaults(type('Forms')).submit_method, 'POST')
    assert.ok(!Object.hasOwn(configurationDefaults(type('Forms')), 'notification_email'))
    const data = renderMetadata(type('Headline'))
    data.name = 'changed'
    assert.equal(renderMetadata(type('Headline')).name, 'Headline')
})

test('validation evaluates arbitrary content and nested fields and strips extras', () => {
    const result = validateConfiguration(type('Forms'), {
        ...form, extra: 'discarded', fields: [{ ...form.fields[0], required: 'yes', extra: 'discarded', defaultValue: 'arbitrary@example.test' }],
    })
    assert.equal(result.valid, true)
    assert.equal(result.value.fields[0].required, true)
    assert.equal(result.value.fields[0].default_value, 'arbitrary@example.test')
    assert.ok(!Object.hasOwn(result.value, 'extra'))
    assert.ok(!Object.hasOwn(result.value.fields[0], 'extra'))
})

test('nested validation errors retain full locations, types, inputs and context', () => {
    const result = validateConfiguration(type('Forms'), { title: 'Different', fields: [{ name: '', label: 'x', type: 'invalid' }] })
    assert.equal(result.valid, false)
    assert.deepEqual(result.errors.map(error => error.loc), [['fields', 0, 'name'], ['fields', 0, 'type']])
    assert.deepEqual(result.errors.map(error => error.type), ['string_too_short', 'literal_error'])
    assert.equal(result.errors[0].input, '')
    assert.equal(result.errors[0].ctx.min_length, 1)
})

test('booleans match Pydantic coercion, with malformed and null values rejected', () => {
    for (const [input, expected] of [[true, true], [false, false], [1, true], [0, false], ['TRUE', true], ['off', false]]) {
        assert.equal(validateConfiguration(type('Headline'), { showBorder: input }).value.showBorder, expected)
    }
    for (const input of [null, [], {}, 'maybe', 2]) assert.equal(validateConfiguration(type('Headline'), { showBorder: input }).valid, false)
})

test('optional values and literal choices retain their distinct semantics', () => {
    assert.equal(validateConfiguration(type('TwoColumns'), { layoutStyle: null }).value.layout_style, null)
    for (const input of ['', '9:9', false]) assert.equal(validateConfiguration(type('TwoColumns'), { layoutStyle: input }).valid, false)
    assert.equal(validateConfiguration(type('Banner'), { textOutline: 'custom-contrast' }).value.text_outline, 'custom-contrast')
    assert.throws(() => validateConfiguration(type('Forms'), null), TypeError)
    assert.throws(() => configurationSchema(type('Content')), /Not a pilot/)
})

test('direct model alias precedence and wire parser collision order stay explicit', () => {
    assert.equal(validateConfiguration(type('TwoColumns'), { layout_style: '1:5', layoutStyle: '4:2' }).value.layout_style, '4:2')
    assert.deepEqual(parseWire({ layout_style: '1:5', layoutStyle: '4:2' }), { layout_style: '4:2' })
    assert.deepEqual(parseWire({ layoutStyle: '4:2', layout_style: '1:5' }), { layout_style: '1:5' })
    assert.deepEqual(parseWire({ image1: { altText: 'x' } }), { image1: { alt_text: 'x' } })
    assert.deepEqual(renderWire({ image_1: { alt_text: 'x' } }), { image1: { altText: 'x' } })
})

test('the documented Headline parser issue stays isolated to transport compatibility', () => {
    assert.equal(validateConfiguration(type('Headline'), { headerLevel: 'h4' }).value.headerLevel, 'h4')
    const response = observeRequest({ method: 'POST', path: `/api/v1/webpages/widget-types/${type('Headline')}/validate/`, body: { configuration: { content: 'New text', headerLevel: 'h4' } } })
    assert.equal(response.body.validatedData.headerLevel, 'h1')
    assert.equal(response.body.validatedData.content, 'New text')
})
