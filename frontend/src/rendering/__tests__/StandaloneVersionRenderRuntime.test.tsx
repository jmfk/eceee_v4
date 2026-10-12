import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPageRenderModel } from '../adapters'
import StandaloneVersionRenderRuntime from '../StandaloneVersionRenderRuntime'

const versionRender = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../directRender', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../directRender')>()
    return { ...actual, loadVersionRenderModel: versionRender.load }
})
vi.mock('../PageRenderer', () => ({
    default: ({ model }: any) => <div data-testid="version-render-document">{model.context.versionId}</div>,
}))

describe('StandaloneVersionRenderRuntime', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/_render-version/42/9/')
        versionRender.load.mockReset()
    })

    it('renders the selected version without Django HTML', async () => {
        window.history.replaceState({}, '', '/_render-version/42/9/?workspace=theme-tenant')
        versionRender.load.mockResolvedValue(createPageRenderModel({
            widgets: {},
            context: { pageId: 42, versionId: 9 },
        }))

        render(<StandaloneVersionRenderRuntime />)

        expect(screen.getByText('Preparing preview…')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByTestId('version-render-document')).toHaveTextContent('9'))
        expect(versionRender.load).toHaveBeenCalledWith({
            pageId: 42,
            versionId: 9,
            tenantIdentifier: 'theme-tenant',
        })
        expect(document.querySelector('iframe')).not.toBeInTheDocument()
    })

    it('shows a useful error when the version cannot be loaded', async () => {
        versionRender.load.mockRejectedValue(new Error('Version not found.'))

        render(<StandaloneVersionRenderRuntime />)

        expect(await screen.findByRole('alert')).toHaveTextContent('Version not found.')
    })
})
