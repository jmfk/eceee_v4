import { describe, expect, it, vi } from 'vitest'
import {
    applyWidgetPropUpdates,
    buildWidgetPropUpdate,
    countConfigChangedFields,
    createActiveWidgetPropContext,
    createPageWidgetConfigChangeHandler,
    shouldHydrateExternalWidgetProps
} from '../pageEditorPropAdapter'

describe('pageEditorPropAdapter', () => {
    it('registers active widget prop context with page and version targeting', () => {
        const context = createActiveWidgetPropContext({
            widgetData: { id: 'content-1', slotName: 'main' },
            context: { pageId: '101', versionId: '201', contextType: 'page' },
            componentId: 'isolated-form-content-1'
        })

        expect(context).toEqual(expect.objectContaining({
            widgetId: 'content-1',
            slotName: 'main',
            contextType: 'page',
            pageId: '101',
            versionId: '201',
            componentId: 'isolated-form-content-1'
        }))
    })

    it('builds a parent-owned widget prop update without changing save payload shape', () => {
        const currentWidgetData = {
            id: 'content-1',
            type: 'easy_widgets.ContentWidget',
            config: { content: '<p>Initial</p>', isActive: true }
        }
        const propContext = createActiveWidgetPropContext({
            widgetData: currentWidgetData,
            slotName: 'main',
            contextType: 'page',
            pageId: '101',
            versionId: '201',
            componentId: 'isolated-form-content-1'
        })

        const update = buildWidgetPropUpdate({
            currentWidgetData,
            propContext,
            fieldName: 'content',
            value: '<p>Panel update</p>',
            activeVariants: ['rich']
        })

        expect(update.fieldPath).toBe('config.content')
        expect(update.isDirty).toBe(true)
        expect(update.fieldSourceId).toBe('isolated-form-content-1-field-content')
        expect(update.updatedWidget.config).toEqual({
            content: '<p>Panel update</p>',
            isActive: true
        })
        expect(update.udcPayload).toEqual({
            id: 'content-1',
            slotName: 'main',
            contextType: 'page',
            pageId: '101',
            versionId: '201',
            config: { content: '<p>Panel update</p>' },
            widgetUpdates: { activeVariants: ['rich'] }
        })
    })

    it('preserves nested widget paths during prop propagation', () => {
        const propContext = createActiveWidgetPropContext({
            widgetData: { id: 'nested-1', config: { content: '<p>Nested</p>' } },
            context: {
                slotName: 'main',
                contextType: 'page',
                widgetPath: ['main', 'container-1', 'children', 'nested-1']
            },
            componentId: 'isolated-form-nested-1'
        })

        const update = buildWidgetPropUpdate({
            currentWidgetData: { id: 'nested-1', config: { content: '<p>Nested</p>' } },
            propContext,
            fieldName: 'content',
            value: '<p>Nested update</p>'
        })

        expect(update.updatedWidget.context.widgetPath).toEqual(['main', 'container-1', 'children', 'nested-1'])
        expect(update.udcPayload.widgetPath).toEqual(['main', 'container-1', 'children', 'nested-1'])
    })

    it('does not hydrate external updates that are already handled by field subscriptions', () => {
        expect(shouldHydrateExternalWidgetProps({
            sourceId: 'isolated-form-content-1-field-content',
            changedFields: ['content']
        })).toBe(false)
        expect(shouldHydrateExternalWidgetProps({
            sourceId: 'field-content-1-content',
            changedFields: ['content']
        })).toBe(false)
        expect(shouldHydrateExternalWidgetProps({
            sourceId: 'widget-content-1',
            changedFields: ['content']
        })).toBe(false)
    })

    it('hydrates external widget snapshots and multi-field legacy updates', () => {
        expect(shouldHydrateExternalWidgetProps({
            sourceId: 'playwright-external-config',
            changedFields: ['content']
        })).toBe(true)
        expect(shouldHydrateExternalWidgetProps({
            sourceId: 'widget-content-1',
            changedFields: ['content', 'isActive']
        })).toBe(true)
    })

    it('applies rapid sequential prop updates in order', () => {
        const finalWidget = applyWidgetPropUpdates(
            { id: 'content-1', config: { content: '<p>Initial</p>', isActive: true } },
            [
                { fieldName: 'content', value: '<p>First</p>' },
                { fieldName: 'content', value: '<p>Second</p>' },
                { fieldName: 'isActive', value: false }
            ]
        )

        expect(finalWidget.config).toEqual({
            content: '<p>Second</p>',
            isActive: false
        })
    })

    it('counts changed fields for hydration decisions', () => {
        expect(countConfigChangedFields(
            { content: '<p>Initial</p>', isActive: true },
            { content: '<p>Updated</p>', isActive: true }
        )).toEqual(['content'])
    })

    it('dispatches active widget config changes through the parent callback contract', () => {
        const onConfigChange = vi.fn()
        const handler = createPageWidgetConfigChangeHandler({
            onConfigChange,
            widget: { id: 'content-1' },
            slotName: 'main'
        })

        handler({ content: '<p>Inline</p>' })

        expect(onConfigChange).toHaveBeenCalledWith('content-1', 'main', {
            content: '<p>Inline</p>'
        })
    })

    it('one inline edit produces exactly one parent callback dispatch', () => {
        const onConfigChange = vi.fn()
        const handler = createPageWidgetConfigChangeHandler({
            onConfigChange,
            widget: { id: 'headline-1' },
            slotName: 'main'
        })

        handler({ content: 'Final headline' })

        expect(onConfigChange).toHaveBeenCalledTimes(1)
        expect(onConfigChange).toHaveBeenLastCalledWith('headline-1', 'main', {
            content: 'Final headline'
        })
    })
})
