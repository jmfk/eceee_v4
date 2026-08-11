import React, { forwardRef, useImperativeHandle } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WidgetEditorPanel from '../WidgetEditorPanel'

const panelEditedWidget = {
    id: 'content-intro',
    type: 'easy_widgets.ContentWidget',
    slotName: 'main',
    config: { content: '<p>Panel edited copy</p>' }
}
const isolatedFormProps = []

vi.mock('../../api/widgetSchemas.js', () => ({
    getWidgetSchema: vi.fn(() => Promise.resolve({ properties: {} })),
    validateWidgetConfiguration: vi.fn(() => Promise.resolve({ errors: {}, warnings: {} }))
}))

vi.mock('../../utils/widgetTypeValidation.js', () => ({
    validateWidgetType: vi.fn(() => Promise.resolve({ isValid: true, canEdit: true, shouldHide: false })),
    clearWidgetTypesCache: vi.fn()
}))

vi.mock('../special-editors', () => ({
    SpecialEditorRenderer: () => null,
    hasSpecialEditor: () => false
}))

vi.mock('../IsolatedFormRenderer.jsx', () => ({
    default: forwardRef((props, ref) => {
        isolatedFormProps.push(props)
        useImperativeHandle(ref, () => ({
            getCurrentWidgetData: () => panelEditedWidget
        }))

        return (
            <button type="button" onClick={() => props.onWidgetChange(panelEditedWidget)}>
                Apply panel edit
            </button>
        )
    })
}))

vi.mock('../WidgetPublishingInheritanceFields.jsx', () => ({
    default: () => null
}))

vi.mock('../widget-help/WidgetQuickReference', () => ({
    default: () => null
}))

describe('WidgetEditorPanel contract', () => {
    beforeEach(() => {
        isolatedFormProps.length = 0
    })

    it('routes panel edits through real-time updates and imperative save', async () => {
        const user = userEvent.setup()
        const onRealTimeUpdate = vi.fn()
        const onSave = vi.fn()
        const panelRef = React.createRef()

        render(
            <WidgetEditorPanel
                ref={panelRef}
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                onRealTimeUpdate={onRealTimeUpdate}
                widgetData={{
                    id: 'content-intro',
                    name: 'Intro',
                    type: 'easy_widgets.ContentWidget',
                    slotName: 'main',
                    config: { content: '<p>Initial copy</p>' }
                }}
                schema={{ properties: { content: { type: 'string' } } }}
                title="Edit Content"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
            />
        )

        await user.click(await screen.findByRole('button', { name: 'Apply panel edit' }))

        expect(onRealTimeUpdate).toHaveBeenCalledOnce()
        expect(onRealTimeUpdate).toHaveBeenCalledWith(panelEditedWidget)
        expect(isolatedFormProps.at(-1).publishChanges).toBe(false)

        let savedWidget
        await act(async () => {
            savedWidget = await panelRef.current.saveCurrentWidget()
        })

        expect(savedWidget).toEqual(panelEditedWidget)
        expect(onSave).toHaveBeenCalledWith(panelEditedWidget)
    })

    it('keeps panel changes pending when parent save reports no persistence yet', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn().mockResolvedValue({ saved: false, reason: 'conflict' })
        const panelRef = React.createRef()

        render(
            <WidgetEditorPanel
                ref={panelRef}
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                onRealTimeUpdate={vi.fn()}
                widgetData={{
                    id: 'content-intro',
                    name: 'Intro',
                    type: 'easy_widgets.ContentWidget',
                    slotName: 'main',
                    config: { content: '<p>Initial copy</p>' }
                }}
                schema={{ properties: { content: { type: 'string' } } }}
                title="Edit Content"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
            />
        )

        await user.click(await screen.findByRole('button', { name: 'Apply panel edit' }))
        expect(panelRef.current.hasUnsavedChanges()).toBe(true)

        await act(async () => {
            await panelRef.current.saveCurrentWidget()
        })

        expect(onSave).toHaveBeenCalledWith(panelEditedWidget)
        expect(panelRef.current.hasUnsavedChanges()).toBe(true)
    })

    it('keeps panel changes pending when parent save rejects', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn().mockRejectedValue(new Error('save failed'))
        const panelRef = React.createRef()

        render(
            <WidgetEditorPanel
                ref={panelRef}
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                onRealTimeUpdate={vi.fn()}
                widgetData={{
                    id: 'content-intro',
                    name: 'Intro',
                    type: 'easy_widgets.ContentWidget',
                    slotName: 'main',
                    config: { content: '<p>Initial copy</p>' }
                }}
                schema={{ properties: { content: { type: 'string' } } }}
                title="Edit Content"
                context={{ contextType: 'page', pageId: '101', versionId: '201' }}
            />
        )

        await user.click(await screen.findByRole('button', { name: 'Apply panel edit' }))
        expect(panelRef.current.hasUnsavedChanges()).toBe(true)

        await expect(panelRef.current.saveCurrentWidget()).rejects.toThrow('save failed')

        expect(onSave).toHaveBeenCalledWith(panelEditedWidget)
        expect(panelRef.current.hasUnsavedChanges()).toBe(true)
    })
})
