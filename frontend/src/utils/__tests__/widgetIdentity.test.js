import { describe, expect, it } from 'vitest'
import { regenerateWidgetIds } from '../widgetIdentity'

describe('regenerateWidgetIds', () => {
    it('regenerates nested IDs without changing inheritance settings', () => {
        const source = {
            id: 'footer-1',
            type: 'easy_widgets.FooterWidget',
            inheritanceLevel: -1,
            inheritanceBehavior: 'insert_after_parent',
            config: {
                slots: {
                    content: [{
                        id: 'columns-1',
                        type: 'easy_widgets.ThreeColumnsWidget',
                        inheritanceLevel: -1,
                        inheritanceBehavior: 'insert_after_parent',
                        config: { slots: {} },
                    }],
                },
            },
        }

        const copy = regenerateWidgetIds(source)

        expect(copy.id).not.toBe(source.id)
        expect(copy.config.slots.content[0].id).not.toBe(source.config.slots.content[0].id)
        expect(copy).toMatchObject({
            inheritanceLevel: -1,
            inheritanceBehavior: 'insert_after_parent',
            config: {
                slots: {
                    content: [{
                        inheritanceLevel: -1,
                        inheritanceBehavior: 'insert_after_parent',
                    }],
                },
            },
        })
        expect(source.id).toBe('footer-1')
        expect(source.config.slots.content[0].id).toBe('columns-1')
    })
})
