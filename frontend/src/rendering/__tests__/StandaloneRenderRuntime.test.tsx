import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPageRenderModel } from '../adapters'
import StandaloneRenderRuntime from '../StandaloneRenderRuntime'

const directRender = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../directRender', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../directRender')>()
    return { ...actual, loadDirectRenderModel: directRender.load }
})
vi.mock('../PageRenderer', () => ({
    default: ({ model }: any) => <div>
        <div data-testid="saved-render-document">{model.context.pageId}</div>
        <a href="/_render/85/for-authors/publication-ethics/">Navigate preview</a>
        <a href="#details">Page details</a>
        <a href="https://external.example/">External</a>
        <form aria-label="Preview form"><button type="submit">Submit</button></form>
    </div>,
}))

describe('StandaloneRenderRuntime', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/_render/85/for-authors/review-process/')
        directRender.load.mockReset()
    })

    it('loads the route and renders the saved model without an iframe', async () => {
        directRender.load.mockResolvedValue(createPageRenderModel({
            widgets: {},
            context: { pageId: 92 },
        }))

        render(<StandaloneRenderRuntime />)

        expect(screen.getByText('Preparing preview…')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByTestId('saved-render-document')).toHaveTextContent('92'))
        expect(document.querySelector('iframe')).not.toBeInTheDocument()
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
            .mockResolvedValueOnce(createPageRenderModel({ widgets: {}, context: { pageId: 92, renderRoutePrefix: '/_render/85' } }))
            .mockResolvedValueOnce(createPageRenderModel({ widgets: {}, context: { pageId: 93, renderRoutePrefix: '/_render/85' } }))

        render(<StandaloneRenderRuntime />)
        await screen.findByText('92')
        fireEvent.click(screen.getByRole('link', { name: 'Navigate preview' }))

        await waitFor(() => expect(screen.getByTestId('saved-render-document')).toHaveTextContent('93'))
        expect(window.location.pathname).toBe('/_render/85/for-authors/publication-ethics/')
        expect(directRender.load).toHaveBeenLastCalledWith({
            siteId: 85,
            slugPath: 'for-authors/publication-ethics',
        })
    })

    it('allows anchors and modified internal clicks while blocking external navigation and forms', async () => {
        directRender.load.mockResolvedValue(createPageRenderModel({
            widgets: {},
            context: { pageId: 92, renderRoutePrefix: '/_render/85' },
        }))

        render(<StandaloneRenderRuntime />)
        await screen.findByText('92')

        const anchorClick = new MouseEvent('click', { bubbles: true, cancelable: true })
        screen.getByRole('link', { name: 'Page details' }).dispatchEvent(anchorClick)
        expect(anchorClick.defaultPrevented).toBe(false)

        let modifiedClickWasPrevented = true
        const stopBrowserNavigation = (event: MouseEvent) => {
            modifiedClickWasPrevented = event.defaultPrevented
            event.preventDefault()
        }
        document.addEventListener('click', stopBrowserNavigation)
        const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
        screen.getByRole('link', { name: 'Navigate preview' }).dispatchEvent(modifiedClick)
        document.removeEventListener('click', stopBrowserNavigation)
        expect(modifiedClickWasPrevented).toBe(false)

        const externalClick = new MouseEvent('click', { bubbles: true, cancelable: true })
        screen.getByRole('link', { name: 'External' }).dispatchEvent(externalClick)
        expect(externalClick.defaultPrevented).toBe(true)

        const submit = new Event('submit', { bubbles: true, cancelable: true })
        screen.getByRole('form', { name: 'Preview form' }).dispatchEvent(submit)
        expect(submit.defaultPrevented).toBe(true)
        expect(directRender.load).toHaveBeenCalledOnce()
    })
})
