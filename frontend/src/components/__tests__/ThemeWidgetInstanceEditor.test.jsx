import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeWidgetInstanceEditor from '../ThemeWidgetInstanceEditor'

const fixtures = vi.hoisted(() => {
    const id = '2bf85f1b-26cc-4801-8cfa-bb680f93e256'
    return { theme: { id: 1, widgetTypes: { version: 1, items: [{ id, name: 'Person card', active_version: 2, releases: [
        { version: 1, schema: { type: 'object', properties: { name: { type: 'string' }, oldValue: { type: 'string' } } }, defaults: {} },
        { version: 2, schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } }, required: ['role'] }, defaults: { role: '' } },
    ] }] } }, validate: vi.fn() }
})
vi.mock('../../contexts/WidgetThemeContext', () => ({ useWidgetTheme: () => fixtures.theme }))
vi.mock('../../utils/fieldTypeRegistry', () => ({ fieldTypeRegistry: { ensureLoaded: () => Promise.resolve() } }))
vi.mock('../../api/widgetSchemas', () => ({ validateWidgetConfiguration: (...args) => fixtures.validate(...args) }))
vi.mock('../forms/SchemaFieldRenderer', () => ({ default: ({ fieldName, value, onChange }) => <label>{fieldName}<input aria-label={fieldName} value={value || ''} onChange={event => onChange(fieldName, event.target.value)} /></label> }))

describe('Pinned widget upgrades', () => {
    beforeEach(() => fixtures.validate.mockReset())
    it('keeps the original untouched until an explicitly validated save', async () => {
        const widget = { id: 'person', type: 'theme_widgets.2bf85f1b-26cc-4801-8cfa-bb680f93e256', typeVersion: 1, config: { name: 'Alex', oldValue: 'Keep in history' } }
        const onSave = vi.fn()
        fixtures.validate.mockResolvedValueOnce({ isValid: false, errors: { role: ['Required'] } })
            .mockResolvedValueOnce({ isValid: true, errors: {} })
        render(<ThemeWidgetInstanceEditor isOpen widgetData={widget} onSave={onSave} onClose={vi.fn()} />)
        await screen.findByLabelText('name')
        fireEvent.click(screen.getByRole('button', { name: 'Upgrade to version 2' }))
        expect(widget.typeVersion).toBe(1)
        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText("oldValue")).toBeInTheDocument()
        expect(screen.getByText("Keep in history")).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Save widget' }))
        await screen.findByText('role: Required')
        expect(onSave).not.toHaveBeenCalled()
        fireEvent.change(screen.getByLabelText('role'), { target: { value: 'Speaker' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save widget' }))
        await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ typeVersion: 2, config: { name: 'Alex', role: 'Speaker' }, widgetUpdates: { typeVersion: 2 } })))
        expect(widget.config.oldValue).toBe('Keep in history')
    })
    it('keeps a dirty draft and blocks stale overwrites when the widget changes externally', async () => {
        const widget = { id: 'person', type: 'theme_widgets.2bf85f1b-26cc-4801-8cfa-bb680f93e256', typeVersion: 1, config: { name: 'Alex' } }
        const onSave = vi.fn()
        const view = render(<ThemeWidgetInstanceEditor isOpen widgetData={widget} onSave={onSave} />)
        fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Local draft' } })
        view.rerender(<ThemeWidgetInstanceEditor isOpen widgetData={{ ...widget, typeVersion: 2, config: { name: 'External edit', role: 'Speaker' } }} onSave={onSave} />)
        expect(screen.getByLabelText('name')).toHaveValue('Local draft')
        expect(screen.getByText(/changed elsewhere/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save widget' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Save widget' }))
        expect(onSave).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Reload latest widget' }))
        expect(screen.getByLabelText('name')).toHaveValue('External edit')
        expect(screen.getByText('Type version 2')).toBeInTheDocument()
    })

})
