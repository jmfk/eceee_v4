import { describe, expect, it } from 'vitest'
import { transformInheritanceData } from '../widgetMerging'

describe('transformInheritanceData', () => {
    const slots = {
        header: {
            inheritedWidgets: [{ id: 'header-1', type: 'easy_widgets.HeaderWidget', config: {} }],
            inheritanceAllowed: true,
            allowMerge: true,
            mergeMode: true,
            collapseBehavior: 'any',
        },
    }

    it.each([
        ['tree response', { version: 'tree', tree: { slots: {} }, legacy: { slots, parentId: 7, hasParent: true } }],
        ['legacy fallback', { slots, parentId: 7, hasParent: true }],
    ])('exposes inherited widgets and slot rules from a %s', (_name, response) => {
        const result = transformInheritanceData(response)

        expect(result.inheritedWidgets.header).toHaveLength(1)
        expect(result.inheritedWidgets.header[0].id).toBe('header-1')
        expect(result.slotInheritanceRules.header).toMatchObject({
            inheritanceAllowed: true,
            mergeMode: true,
            collapseBehavior: 'any',
        })
        expect(result.hasInheritedContent).toBe(true)
        expect(result.parentId).toBe(7)
        expect(result.hasParent).toBe(true)
    })
})
