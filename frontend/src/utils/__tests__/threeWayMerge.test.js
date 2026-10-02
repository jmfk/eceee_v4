import { describe, expect, it } from 'vitest'

import { mergeValue } from '../threeWayMerge'
import { applyConflictResolutions, detectPageConflicts } from '../conflictResolution'

const widget = (id, config = {}) => ({ id, type: 'Content', config })

describe('threeWayMerge', () => {
    it('merges independent object leaves', () => {
        const result = mergeValue(
            { title: 'Before', settings: { color: 'red', size: 'm' } },
            { title: 'Local', settings: { color: 'red', size: 'm' } },
            { title: 'Before', settings: { color: 'blue', size: 'm' } },
        )

        expect(result.value).toEqual({ title: 'Local', settings: { color: 'blue', size: 'm' } })
        expect(result.diffs.some(diff => diff.hasConflict)).toBe(false)
    })

    it('merges edits to different widgets and nested slots by identity', () => {
        const original = [
            widget('a', { text: 'A' }),
            widget('container', { slots: { body: [widget('nested', { text: 'N' })] } }),
        ]
        const local = structuredClone(original)
        local[0].config.text = 'Local A'
        const server = structuredClone(original)
        server[1].config.slots.body[0].config.text = 'Server N'

        const result = mergeValue(original, local, server, ['widgets'])

        expect(result.value[0].config.text).toBe('Local A')
        expect(result.value[1].config.slots.body[0].config.text).toBe('Server N')
        expect(result.diffs.some(diff => diff.hasConflict)).toBe(false)
    })

    it('combines simultaneous additions at the same anchor deterministically by id', () => {
        const original = [widget('anchor')]
        const local = [widget('anchor'), widget('z-local')]
        const server = [widget('anchor'), widget('a-server')]

        const result = mergeValue(original, local, server, ['widgets'])

        expect(result.value.map(item => item.id)).toEqual(['anchor', 'a-server', 'z-local'])
        expect(result.diffs.some(diff => diff.hasConflict)).toBe(false)
    })

    it('preserves each editor relative order for multiple simultaneous additions', () => {
        const original = [widget('anchor')]
        const local = [widget('anchor'), widget('z-local'), widget('a-local')]
        const server = [widget('anchor'), widget('m-server'), widget('b-server')]

        const result = mergeValue(original, local, server, ['widgets'])
        const order = result.value.map(item => item.id)

        expect(order.indexOf('z-local')).toBeLessThan(order.indexOf('a-local'))
        expect(order.indexOf('m-server')).toBeLessThan(order.indexOf('b-server'))
        expect(result.diffs.some(diff => diff.hasConflict)).toBe(false)
    })

    it('flags incompatible concurrent moves', () => {
        const original = [widget('a'), widget('b'), widget('c')]
        const local = [widget('b'), widget('a'), widget('c')]
        const server = [widget('a'), widget('c'), widget('b')]

        const result = mergeValue(original, local, server, ['widgets'])

        expect(result.diffs.some(diff => diff.hasConflict)).toBe(true)
    })

    it('combines concurrent moves that affect different widgets', () => {
        const original = [widget('a'), widget('b'), widget('c'), widget('d')]
        const local = [widget('b'), widget('a'), widget('c'), widget('d')]
        const server = [widget('a'), widget('b'), widget('d'), widget('c')]

        const result = mergeValue(original, local, server, ['widgets'])

        expect(result.value.map(item => item.id)).toEqual(['b', 'a', 'd', 'c'])
        expect(result.diffs.some(diff => diff.hasConflict)).toBe(false)
    })

    it('flags delete versus edit', () => {
        const original = [widget('a', { text: 'Before' })]
        const local = []
        const server = [widget('a', { text: 'Server edit' })]

        const result = mergeValue(original, local, server, ['widgets'])

        expect(result.diffs.some(diff => diff.hasConflict)).toBe(true)
    })

    it('flags delete versus move', () => {
        const original = [widget('a'), widget('b'), widget('c')]
        const local = [widget('a'), widget('c')]
        const server = [widget('b'), widget('a'), widget('c')]

        const result = mergeValue(original, local, server, ['widgets'])

        expect(result.diffs.some(diff => diff.hasConflict)).toBe(true)
    })

    it('treats the same rich-text leaf and unkeyed arrays atomically', () => {
        const richText = mergeValue('<p>Before</p>', '<p>Local</p>', '<p>Server</p>', ['body'])
        const unkeyed = mergeValue(['a'], ['a', 'local'], ['a', 'server'], ['classes'])

        expect(richText.diffs[0].hasConflict).toBe(true)
        expect(unkeyed.diffs[0].hasConflict).toBe(true)
    })

    it('flags different edits to the same leaf', () => {
        const result = mergeValue(
            { config: { label: 'Before' } },
            { config: { label: 'Local' } },
            { config: { label: 'Server' } },
        )

        expect(result.diffs).toEqual(expect.arrayContaining([
            expect.objectContaining({ pathString: 'config.label', hasConflict: true }),
        ]))
    })

    it('applies a manual resolution through an identity-keyed widget path', () => {
        const originalVersion = { widgets: { main: [widget('a', { label: 'Before' })] } }
        const localVersion = { widgets: { main: [widget('a', { label: 'Local' })] } }
        const serverVersion = { widgets: { main: [widget('a', { label: 'Server' })] } }
        const analysis = detectPageConflicts({}, {}, {}, originalVersion, localVersion, serverVersion)

        const resolved = applyConflictResolutions(analysis, [
            { field: 'version.widgets.main.a.config.label', useLocal: true },
        ])

        expect(resolved.version.widgets.main[0].config.label).toBe('Local')
    })
})
