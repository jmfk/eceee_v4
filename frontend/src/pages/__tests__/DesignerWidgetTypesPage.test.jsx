import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DesignerWidgetTypesPage from '../DesignerWidgetTypesPage'

const api = vi.hoisted(() => ({ workspace: vi.fn(), previewWidget: vi.fn(), save: vi.fn(), publish: vi.fn() }))
vi.mock('../../api/designerThemes', () => ({ designerThemesApi: api }))
vi.mock('../../components/DesignerNavbar', () => ({ default: () => <nav>Designer</nav> }))
vi.mock('../../components/VisualSchemaEditor', () => ({ default: () => <div>Visual fields</div> }))
vi.mock('../../utils/fieldTypeRegistry', () => ({ fieldTypeRegistry: { ensureLoaded: () => Promise.resolve() } }))
vi.mock('../../components/forms/SchemaFieldRenderer', () => ({ default: ({ fieldName, value, onChange }) => <label>Example {fieldName}<input aria-label={`Example ${fieldName}`} value={value || ''} onChange={event => onChange(fieldName, event.target.value)} /></label> }))

const id = '2bf85f1b-26cc-4801-8cfa-bb680f93e256'
const release = { version: 1, schema: { type: 'object', properties: { title: { type: 'string', default: 'Example' } } }, defaults: { title: 'Example' }, template: '<p>{{title}}</p>', css: '', compiled_css: '' }
const workspace = { id: 7, name: 'Theme', draftVersion: 1, themeConfig: {}, widgetTypes: { version: 1, items: [{ id, name: 'Fact box', active_version: 1, releases: [release] }] } }

const mount = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[`/designer/themes/7/widgets/${id}`]}><Routes><Route path="/designer/themes/:themeId/widgets/:widgetTypeId" element={<DesignerWidgetTypesPage />} /></Routes></MemoryRouter></QueryClientProvider>)

describe('Designer widget authoring', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        api.workspace.mockResolvedValue(structuredClone(workspace))
        api.previewWidget.mockResolvedValue({ definition: release })
    })
    it('saves example data and definition metadata to the shared draft before explicit publication', async () => {
        api.save.mockImplementation(async (themeId, patch) => ({ ...workspace, widgetTypes: patch.widgetTypes, draftVersion: 2, hasDraftChanges: true, draftChangedAreas: ['widget_types'] }))
        api.publish.mockResolvedValue({ ...workspace, draftVersion: 3, hasDraftChanges: false })
        mount()
        fireEvent.change(await screen.findByLabelText('Name', { exact: true }), { target: { value: 'Revised fact box' } })
        fireEvent.change(await screen.findByLabelText('Example title'), { target: { value: 'Saved preview' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
        await screen.findByText(/Unpublished areas: Widget types/)
        expect(api.save).toHaveBeenCalledWith('7', expect.objectContaining({ draftVersion: 1, widgetTypes: expect.objectContaining({ items: [expect.objectContaining({ name: 'Revised fact box', example_data: { title: 'Saved preview' }, releases: [release] })] }) }))
        expect(api.publish).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Publish theme' }))
        await waitFor(() => expect(api.publish).toHaveBeenCalledWith('7', 2))
    })
    it('keeps local edits when the shared draft rejects a stale save', async () => {
        api.save.mockRejectedValue(new Error('The Designer draft changed after you opened it.'))
        mount()
        const input = await screen.findByLabelText('Name', { exact: true })
        fireEvent.change(input, { target: { value: 'Keep this edit' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
        await screen.findByRole('alert')
        expect(input).toHaveValue('Keep this edit')
        expect(api.publish).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Discard local changes' }))
        expect(input).toHaveValue('Fact box')
        expect(screen.queryByRole('alert')).toBeNull()
        expect(api.save).toHaveBeenCalledTimes(1)
    })
})
