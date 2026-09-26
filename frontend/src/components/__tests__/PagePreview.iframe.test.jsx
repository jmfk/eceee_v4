import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../../test/testUtils'
import PagePreview from '../PagePreview'

vi.mock('../../api', () => ({
    previewSizesApi: {
        list: vi.fn().mockResolvedValue([]),
        getPreviewUrl: vi.fn(() => '/api/v1/webpages/pages/86/versions/83/preview/'),
    },
}))

describe('PagePreview iframe', () => {
    it('keeps the configured viewport and allows vertical scrolling', async () => {
        renderWithProviders(<PagePreview
            webpageData={{ id: 86, hostnames: [] }}
            pageVersionData={{ id: 83 }}
        />)

        const iframe = await screen.findByTitle('Page Preview')
        expect(iframe).toHaveAttribute('src', '/__render-frame')
        expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
        expect(iframe).toHaveAttribute('scrolling', 'auto')
        expect(iframe).not.toHaveStyle({ overflow: 'hidden' })
    })

    it('sends unsaved local widgets to the React frame', async () => {
        renderWithProviders(<PagePreview
            webpageData={{ id: 86, hostnames: [] }}
            pageVersionData={{ id: 83, widgets: { main: [] }, codeLayout: 'main_layout' }}
            localWidgets={{ main: [{ id: 'draft-heading', type: 'easy_widgets.HeadlineWidget', config: { content: 'Unsaved heading' } }] }}
        />)

        const iframe = await screen.findByTitle('Page Preview')
        const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')
        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                source: iframe.contentWindow,
                data: { source: 'eceee-render-frame', action: 'ready' },
            }))
        })

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-render-host',
            action: 'render',
            model: expect.objectContaining({
                slots: expect.objectContaining({ main: [expect.objectContaining({ id: 'draft-heading', config: expect.objectContaining({ content: 'Unsaved heading' }) })] }),
            }),
        }), '*'))
    })
})
