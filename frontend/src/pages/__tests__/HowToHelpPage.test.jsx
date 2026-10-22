import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HowToHelpPage from '../HowToHelpPage'

vi.mock('../../components/support/useSupportContext', () => ({
    useSupportTenant: () => '',
    useSupportIdentity: () => 'editor',
    useSupportContext: () => ({ data: { canPublish: false } }),
}))

const renderPage = (initialPath = '/help/how-to') => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
            <Route path="/help/*" element={<HowToHelpPage />} />
        </Routes>
    </MemoryRouter>
    </QueryClientProvider>
)

describe('HowToHelpPage', () => {
    it('renders the how-to sections and table of contents', () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'Hjälpguider' })).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'Sidor' })[0]).toHaveAttribute('href', '/help/how-to/section/pages?lang=sv')
        expect(screen.getAllByRole('link', { name: 'Objekt' })[0]).toHaveAttribute('href', '/help/how-to/section/objects?lang=sv')
        expect(screen.getAllByRole('link', { name: 'Media' })[0]).toHaveAttribute('href', '/help/how-to/section/media?lang=sv')
        expect(screen.getAllByRole('link', { name: 'Taggar' })[0]).toHaveAttribute('href', '/help/how-to/section/tags?lang=sv')
        expect(screen.getAllByRole('link', { name: 'Inställningar' })[0]).toHaveAttribute('href', '/help/how-to/section/settings?lang=sv')
    })

    it('renders written steps and the MP4 player for v1 docs', () => {
        renderPage('/help/how-to/pages-create')

        expect(screen.getByRole('heading', { name: 'Skapa en sida' })).toBeInTheDocument()
        expect(screen.getByText('Öppna Sidor från huvudnavigeringen.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open MP4 file' })).toHaveAttribute(
            'href',
            '/howto-videos/manual/sv/pages-pages-create.mp4'
        )
    })

    it('renders a dedicated route for an individual widget help page', () => {
        renderPage('/help/how-to/widget-header-widget')

        expect(screen.getByRole('heading', { name: 'Header-widget' })).toBeInTheDocument()
        expect(screen.getByText('Konfigurera sidans headerområde.')).toBeInTheDocument()
    })

    it('can render the help site in English', () => {
        renderPage('/help/how-to/pages-create?lang=en')

        expect(screen.getByRole('heading', { name: 'Create a page' })).toBeInTheDocument()
        expect(screen.getByText('Open Pages from the main navigation.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open MP4 file' })).toHaveAttribute(
            'href',
            '/howto-videos/manual/en/pages-pages-create.mp4'
        )
    })
})
