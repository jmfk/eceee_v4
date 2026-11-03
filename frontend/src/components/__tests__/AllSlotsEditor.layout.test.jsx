import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AllSlotsEditor from '../AllSlotsEditor'

const mocks = vi.hoisted(() => ({ allSlots: vi.fn(), get: vi.fn() }))

vi.mock('../../api/layouts', () => ({ layoutsApi: { codeLayouts: mocks } }))
vi.mock('../../editors/page-editor/PageWidgetSelectionModal', () => ({ default: () => null }))

describe('AllSlotsEditor layout status', () => {
    it('uses the unsaved layout choice and normalizes a legacy landingPage declaration', async () => {
        mocks.allSlots.mockResolvedValue({ total: 2, slots: [
            { name: 'main', metadata: { title: 'Main Content' } },
            { name: 'landing_page', metadata: { title: 'Landing Page Main Content' } },
        ] })
        mocks.get.mockResolvedValue({ slotConfiguration: { slots: [{ name: 'landing_page' }] } })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        render(<QueryClientProvider client={queryClient}>
            <AllSlotsEditor
                widgets={{ main: [{ id: 'legacy', type: 'easy_widgets.ContentWidget', config: {} }] }}
                pageVersionData={{
                    codeLayout: 'landing_page',
                    layoutKey: 'main_layout',
                    effectiveTheme: { layouts: { items: [{
                        key: 'landing_page',
                        slots: { landingPage: { label: 'Landing Page Main Content' } },
                        root: { type: 'slot', slot_key: 'landing_page', children: [] },
                    }] } },
                }}
            />
        </QueryClientProvider>)

        const landing = await screen.findByTestId('page-slot-toggle-landing-page')
        expect(within(landing).getByText('Current')).toBeInTheDocument()
        expect(within(screen.getByTestId('page-slot-toggle-main')).getByText('Not shown publicly')).toBeInTheDocument()
    })
})
