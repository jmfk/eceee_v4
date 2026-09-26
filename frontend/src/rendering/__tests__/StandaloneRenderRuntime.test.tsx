import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPageRenderModel } from '../adapters'
import StandaloneRenderRuntime from '../StandaloneRenderRuntime'

const directRender = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../directRender', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../directRender')>()
    return { ...actual, loadDirectRenderModel: directRender.load }
})
vi.mock('../RenderFrame', () => ({
    default: ({ model, onMessage }: any) => <div>
        <div data-testid="saved-render-frame">{model.context.pageId}</div>
        <button type="button" onClick={() => onMessage?.({
            data: {
                source: 'eceee-render-frame',
                action: 'navigate',
                href: '/_render/85/for-authors/publication-ethics/',
            },
        })}>Navigate preview</button>
    </div>,
}))

describe('StandaloneRenderRuntime', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/_render/85/for-authors/review-process/')
        directRender.load.mockReset()
    })

    it('loads the route and hands the saved model to the isolated frame', async () => {
        directRender.load.mockResolvedValue(createPageRenderModel({
            widgets: {},
            context: { pageId: 92 },
        }))

        render(<StandaloneRenderRuntime />)

        expect(screen.getByText('Preparing preview…')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByTestId('saved-render-frame')).toHaveTextContent('92'))
        expect(directRender.load).toHaveBeenCalledWith({
            siteId: 85,
            slugPath: 'for-authors/review-process',
        })
    })

    it('shows a useful error when the saved route cannot be resolved', async () => {
        directRender.load.mockRejectedValue(new Error('Page not found.'))

        render(<StandaloneRenderRuntime />)

        expect(await screen.findByRole('alert')).toHaveTextContent('Page not found.')
    })

    it('loads internal preview links in place and updates browser history', async () => {
        directRender.load
            .mockResolvedValueOnce(createPageRenderModel({ widgets: {}, context: { pageId: 92 } }))
            .mockResolvedValueOnce(createPageRenderModel({ widgets: {}, context: { pageId: 93 } }))

        render(<StandaloneRenderRuntime />)
        await screen.findByText('92')
        fireEvent.click(screen.getByRole('button', { name: 'Navigate preview' }))

        await waitFor(() => expect(screen.getByTestId('saved-render-frame')).toHaveTextContent('93'))
        expect(window.location.pathname).toBe('/_render/85/for-authors/publication-ethics/')
        expect(directRender.load).toHaveBeenLastCalledWith({
            siteId: 85,
            slugPath: 'for-authors/publication-ethics',
        })
    })
})
