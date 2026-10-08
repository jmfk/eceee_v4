import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
        render(
            <PageWidgetSelectionModal
                isOpen
                onClose={vi.fn()}
                onWidgetSelect={vi.fn()}
                slotName="main"
                slotLabel="Main"
                allowedWidgetTypes={['*']}
                disallowedWidgetTypes={['easy_widgets.HeaderWidget']}
            />
        )

        await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument())
        expect(screen.queryByText('Header')).not.toBeInTheDocument()
        expect(screen.queryByText('Show All Widgets')).not.toBeInTheDocument()
    })
})
