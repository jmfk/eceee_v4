import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { api } from '../../api/client'
import ArticleImageCandidates from './ArticleImageCandidates'

vi.mock('../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

it('generates from optional instructions and refreshes the retained variants', async () => {
    const candidate = { id: '1', previewUrl: '/first.png', expiresAt: '2026-11-30T12:00:00Z' }
    vi.mocked(api.get)
        .mockResolvedValueOnce({ data: { available: true, items: [candidate] } })
        .mockResolvedValueOnce({
            data: { available: true, items: [candidate, { ...candidate, id: '2', previewUrl: '/second.png' }] },
        })
    vi.mocked(api.post).mockResolvedValue({ data: { id: '2' } })
    const queryClient = new QueryClient()
    render(<QueryClientProvider client={queryClient}><ArticleImageCandidates articleId="42" /></QueryClientProvider>)
    const generate = await screen.findByRole('button', { name: 'Generate image' })
    fireEvent.change(screen.getByLabelText('Image instructions (optional)'), { target: { value: 'Watercolor' } })
    fireEvent.click(generate)
    expect(await screen.findByAltText('Generated image variant 2')).toHaveAttribute('src', '/second.png')
    expect(screen.getByAltText('Generated image variant 1')).toHaveAttribute('src', '/first.png')
    expect(api.post).toHaveBeenCalledWith('/api/v1/objects/objects/42/image-candidates/', { prompt: 'Watercolor' })
})
