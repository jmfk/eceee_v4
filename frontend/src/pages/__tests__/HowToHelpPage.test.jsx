import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HowToHelpPage from '../HowToHelpPage'

const mocks = vi.hoisted(() => ({ language: 'en-us' }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ language: mocks.language }) }))

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
    beforeEach(() => { mocks.language = 'en-us' })
    it('renders the how-to sections and table of contents', () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'How-To Help' })).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'Pages' })[0]).toHaveAttribute('href', '/help/how-to/section/pages?lang=en')
    })

    it('renders written steps and the MP4 player for v1 docs', () => {
        renderPage('/help/how-to/pages-create')

        expect(screen.getByRole('heading', { name: 'Create a page' })).toBeInTheDocument()
        expect(screen.getByText('Open Pages from the main navigation.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open MP4 file' })).toHaveAttribute(
            'href',
            '/howto-videos/manual/en/pages-pages-create.mp4'
        )
    })

    it('renders a dedicated route for an individual widget help page', () => {
        renderPage('/help/how-to/widget-header-widget')

        expect(screen.getByRole('heading', { name: 'Header widget' })).toBeInTheDocument()
    })

    it('can render the help site in Swedish', () => {
        renderPage('/help/how-to/pages-create?lang=sv')

        expect(screen.getByRole('heading', { name: 'Skapa en sida' })).toBeInTheDocument()
        expect(document.documentElement.lang).toBe('sv-se')
        expect(screen.getByText('Öppna Sidor från huvudnavigeringen.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open MP4 file' })).toHaveAttribute(
            'href',
            '/howto-videos/manual/sv/pages-pages-create.mp4'
        )
    })

    it('uses the CMS language for help when the URL has no language override', () => {
        mocks.language = 'sv-se'
        renderPage('/help/how-to/pages-create')
        expect(screen.getByRole('heading', { name: 'Skapa en sida' })).toBeInTheDocument()
    })

    it('keeps the report workspace while navigating within help', () => {
        renderPage('/help/how-to/record-bug-video?tenant=report-workspace')
        const sectionLink = screen.getAllByRole('link', { name: 'Inbox and support' })[0]
        expect(sectionLink).toHaveAttribute('href', '/help/how-to/section/support?lang=en&tenant=report-workspace')
        fireEvent.click(sectionLink)
        expect(screen.getByRole('heading', { name: 'Inbox and support' })).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'Record a five-second bug report' })[0]).toHaveAttribute(
            'href', '/help/how-to/record-bug-video?lang=en&tenant=report-workspace',
        )
    })
})
