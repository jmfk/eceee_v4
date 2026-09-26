import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithStateProviders } from '../../../test/testUtils'
import PreviewViewsTab from '../PreviewViewsTab'

const mocks = vi.hoisted(() => ({
    previewContentSources: vi.fn(),
    importPreviewContent: vi.fn(),
}))

vi.mock('../../../api', () => ({ themesApi: mocks }))
vi.mock('../../../editors/page-editor/PageContentEditor', () => ({
    default: ({ pageVersionData }) => <div>Page widgets for {pageVersionData.codeLayout}</div>,
}))
vi.mock('../../ObjectContentEditor', () => ({ default: () => <div>Object widgets</div> }))
vi.mock('../../WidgetEditorPanel', () => ({ default: () => null }))
vi.mock('../../objectEdit/ObjectDataForm', () => ({ default: () => <div>Object fields</div> }))

const sources = {
    layouts: [{ key: 'main_layout', label: 'Main layout' }],
    pages: [{ id: 12, label: 'Conference — Programme' }],
    objects: [{ id: 21, label: 'Article — Welcome' }],
    objectTypes: [{ key: 'article', label: 'Article', schema: { properties: {} }, slotConfiguration: { slots: [] } }],
}

const Harness = () => {
    const [preview, setPreview] = useState({ views: [] })
    return <PreviewViewsTab designerPreview={preview} onChange={setPreview} themeId="7" />
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
        renderWithStateProviders(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: 'New page' }))
        expect(screen.getAllByDisplayValue('New preview page')).toHaveLength(2)
        expect(screen.getByText('Page widgets for main_layout')).toBeInTheDocument()

        await screen.findByRole('option', { name: 'Article' })
        fireEvent.click(screen.getByRole('button', { name: 'New object' }))
        expect(screen.getByDisplayValue('New Article')).toBeInTheDocument()
        expect(screen.getByText('Object widgets')).toBeInTheDocument()
        expect(screen.getByText('Object fields')).toBeInTheDocument()
    })

    it('copies a selected tenant page into the theme preview collection', async () => {
        renderWithStateProviders(<Harness />)

        await screen.findByRole('option', { name: 'Conference — Programme' })
        fireEvent.click(screen.getByRole('button', { name: 'Copy into theme' }))

        await waitFor(() => expect(mocks.importPreviewContent).toHaveBeenCalledWith('7', 'page', 12))
        expect(await screen.findAllByDisplayValue('Programme')).toHaveLength(2)
    })
})
