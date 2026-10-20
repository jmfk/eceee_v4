// Regression coverage for stable side-column editing.
import React, { createRef, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WidgetEditorPanel from '../WidgetEditorPanel'
import IsolatedFormRenderer from '../IsolatedFormRenderer'
import SchemaFieldRenderer from '../forms/SchemaFieldRenderer'
import RichTextInput from '../form-fields/RichTextInput'
import { getWidgetSchema } from '../../api/widgetSchemas'
import { validateWidgetType } from '../../utils/widgetTypeValidation'
import { fieldTypeRegistry } from '../../utils/fieldTypeRegistry'

vi.mock('../../api/widgetSchemas.js', () => ({
    getWidgetSchema: vi.fn(),
    validateWidgetConfiguration: vi.fn(async () => ({ errors: {}, warnings: {} }))
}))
vi.mock('../../utils/widgetTypeValidation.js', () => ({
    validateWidgetType: vi.fn(async () => ({ isValid: true, canEdit: true })),
    clearWidgetTypesCache: vi.fn()
}))
vi.mock('../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: () => {},
        publishUpdate: vi.fn(),
        getState: () => ({})
    })
}))
vi.mock('../special-editors', () => ({
    SpecialEditorRenderer: () => null,
    hasSpecialEditor: () => false
}))
vi.mock('../WidgetPublishingInheritanceFields.jsx', () => ({ default: () => null }))
vi.mock('../widget-help/WidgetQuickReference', () => ({ default: () => null }))

const schema = {
    properties: { title: { type: 'string', component: 'TextInput', title: 'Title' } }
}
const widget = {
    id: 'audit-widget',
    type: 'easy_widgets.BannerWidget',
    slotName: 'main',
    config: { title: 'Initial text' }
}
const context = { contextType: 'page', pageId: '101', versionId: '201' }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const readyInput = async () => {
    let input
    await waitFor(() => {
        input = screen.getByRole('textbox')
        expect(input.readOnly).toBe(false)
    })
    return input
}

function EchoingPanel({ provideSchema = true }) {
    const [currentWidget, setCurrentWidget] = useState(widget)
    return <WidgetEditorPanel
        isOpen
        onClose={() => {}}
        widgetData={currentWidget}
        schema={provideSchema ? schema : undefined}
        context={context}
        onRealTimeUpdate={setCurrentWidget}
        showPublishingFields={false}
    />
}

describe('Side-column editing acceptance regressions', () => {
    afterEach(() => vi.restoreAllMocks())
    beforeEach(() => {
        vi.clearAllMocks()
        getWidgetSchema.mockResolvedValue(schema)
        validateWidgetType.mockResolvedValue({ isValid: true, canEdit: true })
    })

    it('keeps the focused input and its selection when its change returns through page props', async () => {
        render(<EchoingPanel />)
        const input = await readyInput()
        act(() => input.focus())
        fireEvent.change(input, { target: { value: 'Edited text' } })
        input.setSelectionRange(2, 6)
        await act(async () => { await delay(260) })
        const currentInput = await readyInput()
        expect(currentInput).toBe(input)
        expect(currentInput).toHaveFocus()
        expect(currentInput.selectionStart).toBe(2)
        expect(currentInput.selectionEnd).toBe(6)
    })

    it('does not reload the widget schema for a content-only change', async () => {
        render(<EchoingPanel provideSchema={false} />)
        const input = await readyInput()
        const initialCalls = getWidgetSchema.mock.calls.length
        fireEvent.change(input, { target: { value: 'Edited text' } })
        await act(async () => { await delay(260) })
        await readyInput()
        expect(getWidgetSchema).toHaveBeenCalledTimes(initialCalls)
    })

    it('includes the last keystroke in the buffer used by immediate save', async () => {
        const ref = createRef()
        render(<IsolatedFormRenderer
            ref={ref}
            initWidgetData={widget}
            initschema={schema}
            widgetId={widget.id}
            slotName="main"
            contextType="page"
            context={context}
            publishChanges={false}
        />)
        const input = await readyInput()
        fireEvent.change(input, { target: { value: 'Last keystroke' } })
        expect(input).toHaveValue('Last keystroke')
        expect(ref.current.getCurrentWidgetData().config.title).toBe('Last keystroke')
    })

    it('preserves the registry field DOM when parent props are rendered again', async () => {
        vi.spyOn(fieldTypeRegistry, 'getFieldType').mockReturnValue({ component: 'TextInput' })
        const fieldProps = { fieldName: 'title', fieldSchema: { type: 'string' }, value: 'Text', onChange: vi.fn() }
        const { rerender } = render(<SchemaFieldRenderer {...fieldProps} />)
        const input = await readyInput()
        act(() => input.focus())
        rerender(<SchemaFieldRenderer {...fieldProps} />)
        await act(async () => { await delay(0) })
        expect(await screen.findByRole('textbox')).toBe(input)
        expect(input).toHaveFocus()
    })

    it('loads a newly selected widget without retaining the previous form buffer', async () => {
        const ref = createRef()
        const formProps = {
            ref,
            initWidgetData: widget,
            initschema: schema,
            widgetId: widget.id,
            slotName: 'main',
            contextType: 'page',
            context,
            publishChanges: false
        }
        const { rerender } = render(<IsolatedFormRenderer {...formProps} />)
        await readyInput()
        const nextWidget = { ...widget, id: 'next-widget', config: { title: 'Next widget text' } }
        rerender(<IsolatedFormRenderer {...formProps} initWidgetData={nextWidget} widgetId={nextWidget.id} />)
        expect(ref.current.getCurrentWidgetData()).toEqual(nextWidget)
    })

    it('offers formatted editing for richtext fields', () => {
        const { container } = render(<RichTextInput value="<p>Text</p>" onChange={vi.fn()} />)
        expect(container.querySelector('[contenteditable="true"]')).not.toBeNull()
    })

    it('ignores a previous widget type schema response after switching', async () => {
        let resolveOld
        let resolveNew
        getWidgetSchema.mockImplementation(type => new Promise(resolve => {
            if (type === 'old-type') resolveOld = resolve
            else resolveNew = resolve
        }))
        const props = { isOpen: true, onClose: vi.fn(), context, showPublishingFields: false }
        const { rerender } = render(<WidgetEditorPanel {...props} widgetData={{ ...widget, type: 'old-type' }} />)
        await waitFor(() => expect(resolveOld).toBeTypeOf('function'))
        rerender(<WidgetEditorPanel {...props} widgetData={{ ...widget, id: 'new-widget', type: 'new-type' }} />)
        await waitFor(() => expect(resolveNew).toBeTypeOf('function'))
        await act(async () => resolveNew(schema))
        expect(await readyInput()).toHaveValue('Initial text')
        await act(async () => resolveOld({ properties: { stale: { type: 'string', component: 'TextInput', title: 'Stale field' } } }))
        expect(screen.queryByText('Stale field')).toBeNull()
        expect(await readyInput()).toHaveValue('Initial text')
    })

    it('reloads the schema after an unavailable widget type is restored', async () => {
        validateWidgetType.mockResolvedValueOnce({ isValid: false, canEdit: false })
        render(<EchoingPanel provideSchema={false} />)
        await waitFor(() => expect(getWidgetSchema).toHaveBeenCalledTimes(1))
        fireEvent.click(await screen.findByRole('button', { name: 'Refresh Types' }))
        expect(await readyInput()).toHaveValue('Initial text')
        expect(getWidgetSchema).toHaveBeenCalledTimes(2)
        expect(screen.queryByText('Loading widget configuration...')).toBeNull()
    })
})
