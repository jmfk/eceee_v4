import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { api } from '../../../api/client'
import LinkScreenshotCapture from '../LinkScreenshotCapture'

vi.mock('../../../api/client', () => ({ api: { post: vi.fn() } }))
vi.mock('../../classification/ClassificationPicker', () => ({
    default: ({ onChange }: { onChange: (ids: string[]) => void }) =>
        <button type="button" onClick={() => onChange(['reviewed-tag'])}>Select tag</button>,
}))

it('previews the capture, requires reviewed tags, and returns reusable media', async () => {
    const media = { id: 'saved-media', title: 'example.com' }
    vi.mocked(api.post)
        .mockResolvedValueOnce({ data: { image: btoa('image'), token: 'signed-preview' } })
        .mockResolvedValueOnce({ data: media })
    const onSaved = vi.fn()
    render(<QueryClientProvider client={new QueryClient()}>
        <LinkScreenshotCapture namespace="editorial" onSaved={onSaved} />
    </QueryClientProvider>)
    fireEvent.change(screen.getByLabelText('Public webpage URL'), { target: { value: 'https://example.com/article' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capture screenshot' }))
    expect(await screen.findByAltText('Captured webpage preview')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Save screenshot and continue' })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Select tag' }))
    fireEvent.click(save)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
    const [endpoint, body, options] = vi.mocked(api.post).mock.calls[1] as [string, FormData, { headers: object }]
    expect(endpoint).toBe('/api/v1/media/link-screenshot/save/')
    expect(body.get('classification_ids[0]')).toBe('reviewed-tag')
    expect(body.get('namespace')).toBe('editorial')
    expect(body.get('token')).toBe('signed-preview')
    expect(options.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
    await waitFor(() => expect(onSaved.mock.calls[0]?.[0]).toEqual(media))
})
