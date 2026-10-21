import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PageWidgetSelectionModal from '../PageWidgetSelectionModal'

vi.mock('../../../api', () => ({
    widgetsApi: {
        getTypes: vi.fn(() => Promise.resolve([
            { type: 'easy_widgets.ContentWidget', name: 'Content', category: 'core' },
            { type: 'easy_widgets.HeaderWidget', name: 'Header', category: 'core' },
        ])),
    },
}))

describe('PageWidgetSelectionModal policies', () => {
    it('does not offer an override for disallowed widget types', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
            <PageWidgetSelectionModal
                theme={{ widgetTypes: { version: 1, items: [] } }}
                isOpen
                onClose={vi.fn()}
                onWidgetSelect={vi.fn()}
                slotName="main"
                slotLabel="Main"
                allowedWidgetTypes={['*']}
                disallowedWidgetTypes={['easy_widgets.HeaderWidget']}
            />
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument())
        expect(screen.queryByText('Header')).not.toBeInTheDocument()
        expect(screen.queryByText('Show All Widgets')).not.toBeInTheDocument()
    })
})
