import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DesignerMediaPage from '../DesignerMediaPage'
import DesignerRoute from '../../components/DesignerRoute'

const mocks = vi.hoisted(() => ({ list: vi.fn(), user: null }))
vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'))
vi.mock('../../api/namespaces', () => ({ namespacesApi: { list: mocks.list } }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, logout: vi.fn(), isAuthenticated: true, isLoading: false }) }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'workspace-one' }))
vi.mock('../../components/StatusBar', () => ({ default: () => null }))
vi.mock('../../components/media/MediaBrowser', () => ({
    default: ({ namespace, selectionMode, showUploader, hideActions }) => <div data-testid="media-browser"
        data-namespace={namespace} data-selection-mode={selectionMode}
        data-uploader={String(showUploader)} data-hide-actions={String(hideActions)} />,
}))

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/designer/media']}>
            <Routes>
                <Route path="/designer/media" element={<DesignerRoute><DesignerMediaPage /></DesignerRoute>} />
                <Route path="/media" element={<div>CMS media manager</div>} />
                <Route path="/designer/themes" element={<div>Designer themes</div>} />
                <Route path="/pages" element={<div>Pages</div>} />
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>)
}

describe('Designer Media', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.user = { isDesignerOnly: true, permissions: ['theme.read', 'site.read'] }
        mocks.list.mockResolvedValue({ results: [{ slug: 'theme-media' }] })
    })

    it('opens only the theme namespace without media mutation controls or media.read', async () => {
        renderPage()
        const browser = await screen.findByTestId('media-browser')
        expect(mocks.list).toHaveBeenCalledWith({ kind: 'theme_media', include_hidden: true })
        expect(browser).toHaveAttribute('data-namespace', 'theme-media')
        expect(browser).toHaveAttribute('data-selection-mode', 'none')
        expect(browser).toHaveAttribute('data-uploader', 'false')
        expect(browser).toHaveAttribute('data-hide-actions', 'true')
    })

    it('retains navigation while loading and never opens an unscoped browser', () => {
        mocks.list.mockReturnValue(new Promise(() => {}))
        renderPage()
        expect(screen.getByRole('status')).toHaveTextContent('Loading media library')
        expect(screen.getByRole('link', { name: 'Designer' })).toBeInTheDocument()
        expect(screen.queryByTestId('media-browser')).not.toBeInTheDocument()
    })

    it('offers an in-place retry after the namespace request fails', async () => {
        mocks.list.mockRejectedValueOnce(new Error('unavailable'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load')
        expect(screen.queryByTestId('media-browser')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(await screen.findByTestId('media-browser')).toHaveAttribute('data-namespace', 'theme-media')
    })

    it('keeps an empty theme library scoped and offers the Designer destination', async () => {
        mocks.list.mockResolvedValue({ results: [] })
        renderPage()
        expect(await screen.findByText(/No theme media library yet/)).toBeInTheDocument()
        expect(screen.queryByTestId('media-browser')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open Designer' })).toHaveAttribute('href', '/designer/themes')
    })

    it('redirects CMS media readers without requesting the restricted Designer library', async () => {
        mocks.user = { permissions: ['theme.read', 'media.read'] }
        renderPage()
        await waitFor(() => expect(screen.getByText('CMS media manager')).toBeInTheDocument())
        expect(mocks.list).not.toHaveBeenCalled()
    })

    it('does not grant media access to CMS theme readers', async () => {
        mocks.user = { permissions: ['theme.read'] }
        renderPage()
        expect(await screen.findByText('Designer themes')).toBeInTheDocument()
        expect(mocks.list).not.toHaveBeenCalled()
    })
})
