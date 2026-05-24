import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HowToHelpPage from '../HowToHelpPage'

const renderPage = (initialPath = '/help/how-to') => render(
    <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
            <Route path="/help/*" element={<HowToHelpPage />} />
        </Routes>
    </MemoryRouter>
)

describe('HowToHelpPage', () => {
    it('renders the how-to sections and table of contents', () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'How-To Help' })).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'Pages' })[0]).toHaveAttribute('href', '/help/how-to/section/pages')
        expect(screen.getAllByRole('link', { name: 'Objects' })[0]).toHaveAttribute('href', '/help/how-to/section/objects')
        expect(screen.getAllByRole('link', { name: 'Media' })[0]).toHaveAttribute('href', '/help/how-to/section/media')
        expect(screen.getAllByRole('link', { name: 'Tags' })[0]).toHaveAttribute('href', '/help/how-to/section/tags')
        expect(screen.getAllByRole('link', { name: 'Settings' })[0]).toHaveAttribute('href', '/help/how-to/section/settings')
    })

    it('renders written steps and video placeholders for v1 docs', () => {
        renderPage('/help/how-to/pages-create')

        expect(screen.getByRole('heading', { name: 'Create a page' })).toBeInTheDocument()
        expect(screen.getByText('Open Pages from the main navigation.')).toBeInTheDocument()
        expect(screen.getAllByText('Video coming soon').length).toBeGreaterThan(0)
    })

    it('renders a dedicated route for an individual widget help page', () => {
        renderPage('/help/how-to/widget-header-widget')

        expect(screen.getByRole('heading', { name: 'Header widget' })).toBeInTheDocument()
        expect(screen.getByText('Configure the page header area.')).toBeInTheDocument()
    })
})
