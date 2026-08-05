import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IsolatedFormRenderer from '../IsolatedFormRenderer'

let externalChangeCallbacks = []
let publishUpdateMock = vi.fn()

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
    default: ({ fieldName, onChange }) => (
        <button type="button" onClick={() => onChange(fieldName, `<p>${fieldName} update</p>`)}>
            Change {fieldName}
        </button>
    )
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
})
