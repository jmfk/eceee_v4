import { useEffect, useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../../test/testUtils'
import { useUnifiedData } from '../../../contexts/unified-data/context/UnifiedDataContext'
import PreviewViewsTab from '../PreviewViewsTab'

const mocks = vi.hoisted(() => ({
    previewContentSources: vi.fn(),
    importPreviewContent: vi.fn(),
}))

vi.mock('../../../api', () => ({ themesApi: mocks }))
vi.mock('../../../editors/page-editor/PageContentEditor', () => ({
    default: ({ pageVersionData, namespace }) => <div data-testid="page-content-editor" data-namespace={namespace || ''}>Page widgets for {pageVersionData.codeLayout}</div>,
}))
vi.mock('../../ObjectContentEditor', () => ({ default: ({ namespace }) => <div data-testid="object-content-editor" data-namespace={namespace || ''}>Object widgets</div> }))
vi.mock('../../WidgetEditorPanel', () => ({ default: ({ namespace }) => <div data-testid="widget-editor-panel" data-namespace={namespace || ''} /> }))
vi.mock('../../objectEdit/ObjectDataForm', () => ({
    default: ({ onFormChange }) => <div>Object fields<button type="button" onClick={() => onFormChange({ title: 'Changed', data: { summary: 'Safe', related: 99 } })}>Change object fields</button></div>,
}))

const sources = {
    layouts: [{ key: 'main_layout', label: 'Main layout' }],
    pages: [{ id: 12, label: 'Conference — Programme' }],
    objects: [{ id: 21, label: 'Article — Welcome' }],
    objectTypes: [{ key: 'article', label: 'Article', schema: { properties: { summary: { type: 'string' }, related: { componentType: 'object_reference' } } }, slotConfiguration: { slots: [] } }],
    defaultNamespace: { id: 8, slug: 'tenant-default' },
}

const StateReader = ({ expose }) => {
    const { getState } = useUnifiedData()
    useEffect(() => { expose?.(getState) }, [expose, getState])
    return null
}

const Harness = ({ exposeState, exposePreview }) => {
    const [preview, setPreview] = useState({ views: [] })
    useEffect(() => { exposePreview?.(preview) }, [exposePreview, preview])
    return <><PreviewViewsTab designerPreview={preview} onChange={setPreview} themeId="7" /><StateReader expose={exposeState} /></>
}

describe('PreviewViewsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.previewContentSources.mockResolvedValue(sources)
        mocks.importPreviewContent.mockResolvedValue({
            designer_preview: {
                views: [{
                    id: 'page-imported', label: 'Programme', kind: 'page', layout: 'main_layout',
                    content: { title: 'Programme', pageData: {}, widgets: {}, codeLayout: 'main_layout' },
                }],
            },
        })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('creates theme-owned pages and objects with the regular content editors', async () => {
        let readState
        renderWithStateProviders(<Harness exposeState={(reader) => { readState = reader }} />)

        await screen.findByRole('option', { name: 'Article' })
        fireEvent.click(screen.getByRole('button', { name: 'New page' }))
        expect(screen.getAllByDisplayValue('New preview page')).toHaveLength(2)
        expect(screen.getByText('Page widgets for main_layout')).toBeInTheDocument()
        expect(screen.getByTestId('page-content-editor')).toHaveAttribute('data-namespace', 'tenant-default')
        expect(screen.getByTestId('widget-editor-panel')).toHaveAttribute('data-namespace', 'tenant-default')
        await waitFor(() => {
            const state = readState()
            expect(state.pages[state.metadata.currentPageId]).toBeDefined()
            expect(state.versions[state.metadata.currentVersionId]?.pageId).toBe(state.metadata.currentPageId)
        })
        const newObjectButton = screen.getByRole('button', { name: 'New object' })
        await waitFor(() => expect(newObjectButton).toBeEnabled())
        fireEvent.click(newObjectButton)
        expect(screen.getByDisplayValue('New Article')).toBeInTheDocument()
        expect(screen.getByText('Object widgets')).toBeInTheDocument()
        expect(screen.getByTestId('object-content-editor')).toHaveAttribute('data-namespace', 'tenant-default')
        expect(screen.getByText('Object fields')).toBeInTheDocument()
    })

    it('copies a selected tenant page into the theme preview collection', async () => {
        renderWithStateProviders(<Harness />)

        await screen.findByRole('option', { name: 'Conference — Programme' })
        fireEvent.click(screen.getByRole('button', { name: 'Copy into theme' }))

        await waitFor(() => expect(mocks.importPreviewContent).toHaveBeenCalledWith('7', 'page', 12))
        expect(await screen.findAllByDisplayValue('Programme')).toHaveLength(2)
    })

    it('removes object IDs from theme-preview form updates', async () => {
        let preview
        renderWithStateProviders(<Harness exposePreview={(value) => { preview = value }} />)

        await screen.findByRole('option', { name: 'Article' })
        const newObjectButton = screen.getByRole('button', { name: 'New object' })
        await waitFor(() => expect(newObjectButton).toBeEnabled())
        fireEvent.click(newObjectButton)
        fireEvent.click(await screen.findByRole('button', { name: 'Change object fields' }))

        await waitFor(() => expect(preview.views[0].content.data).toEqual({ summary: 'Safe', related: null }))
    })
})
