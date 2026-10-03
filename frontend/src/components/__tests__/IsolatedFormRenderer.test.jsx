import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IsolatedFormRenderer from '../IsolatedFormRenderer'

let externalChangeCallbacks = []
let publishUpdateMock = vi.fn()
let schemaFieldRenderCount = 0

vi.mock('../../api/widgetSchemas.js', () => ({
    getWidgetSchema: vi.fn(() => Promise.resolve({ properties: {} })),
    validateWidgetConfiguration: vi.fn(() => Promise.resolve({ errors: {}, warnings: {} }))
}))

vi.mock('../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn((componentId, callback) => {
            externalChangeCallbacks.push({ componentId, callback })
        }),
        publishUpdate: publishUpdateMock,
        getState: vi.fn(() => ({ versions: {}, metadata: { currentVersionId: '201' } }))
    })
}))

vi.mock('../forms/SchemaFieldRenderer.jsx', () => ({
    default: ({ fieldName, onChange }) => {
        schemaFieldRenderCount += 1
        return (
            <button type="button" onClick={() => onChange(fieldName, `<p>${fieldName} update</p>`)}>
                Change {fieldName}
            </button>
        )
    }
}))

const baseWidget = {
    id: 'content-1',
    type: 'easy_widgets.ContentWidget',
    slotName: 'main',
    config: { content: '<p>Initial</p>', isActive: true }
}

const schema = {
    properties: {
        content: { type: 'string' }
    }
}

describe('IsolatedFormRenderer active prop ownership', () => {
    beforeEach(() => {
        externalChangeCallbacks = []
        publishUpdateMock = vi.fn()
        schemaFieldRenderCount = 0
        vi.clearAllMocks()
    })

    it('active panel field edits produce one parent update and no direct UDC publish', async () => {
        const onWidgetChange = vi.fn()

        render(
            <IsolatedFormRenderer
                initWidgetData={baseWidget}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={onWidgetChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Change content' }))

        expect(onWidgetChange).toHaveBeenCalledOnce()
        expect(onWidgetChange).toHaveBeenCalledWith(expect.objectContaining({
            id: 'content-1',
            slotName: 'main',
            config: { content: '<p>content update</p>', isActive: true }
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('legacy publishing mode publishes one UDC update and does not also call parent', async () => {
        const onWidgetChange = vi.fn()

        render(
            <IsolatedFormRenderer
                initWidgetData={baseWidget}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges
                onWidgetChange={onWidgetChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Change content' }))

        expect(publishUpdateMock).toHaveBeenCalledOnce()
        expect(publishUpdateMock).toHaveBeenCalledWith(
            'isolated-form-content-1-field-content',
            'UPDATE_WIDGET_CONFIG',
            expect.objectContaining({
                id: 'content-1',
                slotName: 'main',
                contextType: 'page',
                config: { content: '<p>content update</p>' }
            })
        )
        expect(onWidgetChange).not.toHaveBeenCalled()
    })

    it('nested active prop edits preserve widget path and still emit one parent update', () => {
        const onWidgetChange = vi.fn()

        render(
            <IsolatedFormRenderer
                initWidgetData={{ ...baseWidget, id: 'nested-1' }}
                initschema={schema}
                contextType="page"
                widgetId="nested-1"
                slotName="children"
                context={{
                    contextType: 'page',
                    pageId: '101',
                    versionId: '201',
                    widgetPath: ['main', 'container-1', 'children', 'nested-1']
                }}
                publishChanges={false}
                onWidgetChange={onWidgetChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Change content' }))

        expect(onWidgetChange).toHaveBeenCalledOnce()
        expect(onWidgetChange).toHaveBeenCalledWith(expect.objectContaining({
            id: 'nested-1',
            slotName: 'children',
            context: expect.objectContaining({
                widgetPath: ['main', 'container-1', 'children', 'nested-1']
            })
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('external hydration updates form state without echoing a parent/user update', () => {
        const onWidgetChange = vi.fn()

        render(
            <IsolatedFormRenderer
                initWidgetData={baseWidget}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={onWidgetChange}
            />
        )

        const formSubscription = externalChangeCallbacks.find(item => item.componentId === 'isolated-form-content-1')
        formSubscription.callback({
            versions: {
                201: {
                    widgets: {
                        main: [
                            {
                                ...baseWidget,
                                config: { content: '<p>Hydrated externally</p>', isActive: true }
                            }
                        ]
                    }
                }
            },
            metadata: { currentVersionId: '201' }
        }, { sourceId: 'playwright-external-config' })

        expect(onWidgetChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('does not rerender fields for equivalent object props', () => {
        const onWidgetChange = vi.fn()
        const { rerender } = render(
            <IsolatedFormRenderer
                initWidgetData={{ ...baseWidget, config: { ...baseWidget.config } }}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={onWidgetChange}
            />
        )

        expect(schemaFieldRenderCount).toBe(1)

        rerender(
            <IsolatedFormRenderer
                initWidgetData={{ ...baseWidget, config: { ...baseWidget.config } }}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={onWidgetChange}
            />
        )

        expect(schemaFieldRenderCount).toBe(1)
    })

    it('uses the latest parent callback after memoized props change', () => {
        const firstOnWidgetChange = vi.fn()
        const latestOnWidgetChange = vi.fn()
        const { rerender } = render(
            <IsolatedFormRenderer
                initWidgetData={baseWidget}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={firstOnWidgetChange}
            />
        )

        rerender(
            <IsolatedFormRenderer
                initWidgetData={baseWidget}
                initschema={schema}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={latestOnWidgetChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Change content' }))

        expect(firstOnWidgetChange).not.toHaveBeenCalled()
        expect(latestOnWidgetChange).toHaveBeenCalledOnce()
    })

    it('keeps primary ImageWidget fields visible and collapses secondary groups by default', () => {
        render(
            <IsolatedFormRenderer
                initWidgetData={{
                    ...baseWidget,
                    id: 'image-1',
                    type: 'easy_widgets.ImageWidget',
                    config: { image: null, imageStyle: null, showCaptions: true }
                }}
                initschema={{
                    properties: {
                        image: { type: 'object', group: 'Media' },
                        imageStyle: { type: 'string', group: 'Display Options', editorPrimary: true },
                        showCaptions: { type: 'boolean', group: 'Override Settings' }
                    }
                }}
                contextType="page"
                widgetId="image-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={vi.fn()}
            />
        )

        const accordion = screen.getByText('Override Settings').closest('details')

        expect(screen.getByRole('button', { name: 'Change image' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Change imageStyle' })).toBeVisible()
        expect(accordion).not.toHaveAttribute('open')
        expect(screen.getByRole('button', { name: 'Change showCaptions' })).not.toBeVisible()

        fireEvent.click(screen.getByText('Override Settings'))

        expect(accordion).toHaveAttribute('open')
        expect(screen.getByRole('button', { name: 'Change showCaptions' })).toBeVisible()
    })

    it('collapses fields assigned to secondary groups', () => {
        render(
            <IsolatedFormRenderer
                initWidgetData={{
                    ...baseWidget,
                    config: { content: '<p>Initial</p>', allowScripts: false, showBorder: false }
                }}
                initschema={{
                    properties: {
                        content: { type: 'string' },
                        allowScripts: { type: 'boolean', group: 'Advanced' },
                        showBorder: { type: 'boolean', group: 'Styling' }
                    }
                }}
                contextType="page"
                widgetId="content-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Change content' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Change allowScripts' })).not.toBeVisible()
        expect(screen.getByRole('button', { name: 'Change showBorder' })).not.toBeVisible()
        expect(screen.getByText('Advanced').closest('details')).not.toHaveAttribute('open')
        expect(screen.getByText('Styling').closest('details')).not.toHaveAttribute('open')
    })

    it('keeps required and explicitly primary fields visible without a field-name registry', () => {
        render(
            <IsolatedFormRenderer
                initWidgetData={{
                    ...baseWidget,
                    id: 'object-list-1',
                    type: 'object_storage.ObjectListWidget',
                    config: { object_type: 'news', limit: 5, display_template: 'card', show_hierarchy: false }
                }}
                initschema={{
                    required: ['object_type'],
                    properties: {
                        object_type: { type: 'string', group: 'Data source' },
                        limit: { type: 'number', group: 'Content' },
                        display_template: { type: 'string' },
                        show_hierarchy: { type: 'boolean', group: 'Display Options' }
                    }
                }}
                contextType="page"
                widgetId="object-list-1"
                slotName="main"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
                publishChanges={false}
                onWidgetChange={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Change object_type' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Change limit' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Change display_template' })).not.toBeVisible()
        expect(screen.getByRole('button', { name: 'Change show_hierarchy' })).not.toBeVisible()
        expect(screen.getByText('More settings').closest('details')).not.toHaveAttribute('open')
    })
})
