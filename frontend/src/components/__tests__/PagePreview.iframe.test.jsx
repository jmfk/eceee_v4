import { screen } from '@testing-library/react'
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
    it('keeps the configured viewport but hides its internal scrollbars', async () => {
        renderWithProviders(<PagePreview
            webpageData={{ id: 86, hostnames: [] }}
            pageVersionData={{ id: 83 }}
        />)

        const iframe = await screen.findByTitle('Page Preview')
        expect(iframe).toHaveAttribute('scrolling', 'no')
        expect(iframe).toHaveStyle({ overflow: 'hidden' })
    })
})
