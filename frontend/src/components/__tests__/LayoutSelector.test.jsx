import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LayoutSelector from '../LayoutSelector'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('../../api/layouts', () => ({ layoutsApi: { codeLayouts: { list: mocks.list } } }))

describe('LayoutSelector', () => {
    it('shows the selected theme layout as an editable theme layout', async () => {
        mocks.list.mockResolvedValue({ results: [{
            name: 'landing_page', type: 'theme', description: 'Landing page',
            slotConfiguration: { slots: [{ name: 'landing_page' }] },
        }] })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        render(<QueryClientProvider client={queryClient}>
            <LayoutSelector value="landing_page" themeId={2} onChange={vi.fn()} />
        </QueryClientProvider>)

        expect(await screen.findByRole('button', { name: /landing_page theme layout/i })).toBeInTheDocument()
        expect(mocks.list).toHaveBeenCalledWith(true, 'effective', 2)
        fireEvent.click(screen.getByRole('button', { name: /landing_page theme layout/i }))
        expect(screen.getByText('Theme Layouts (1)')).toBeInTheDocument()
        expect(screen.queryByText('Code Layouts (1)')).not.toBeInTheDocument()
    })
})
