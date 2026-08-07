import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ContextualHelpLink from '../ContextualHelpLink'

describe('ContextualHelpLink', () => {
    it('opens a contextual help menu with guide links', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter>
                <ContextualHelpLink topicId="pages" label="Open Pages help" />
            </MemoryRouter>
        )

        const button = screen.getByRole('button', { name: 'Open Pages help' })
        await user.click(button)

        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /create a page/i })).toHaveAttribute(
            'href',
            '/help/how-to/pages-create'
        )
        expect(screen.getByRole('menuitem', { name: /create a page/i })).toHaveAttribute('target', '_blank')
        expect(screen.getAllByText('Instructions and MP4 player').length).toBeGreaterThan(0)
    })

    it('opens widget-specific help from widget headers', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter>
                <ContextualHelpLink topicId="widget-header-widget" label="Open HeaderWidget widget help" size="sm" />
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'Open HeaderWidget widget help' }))

        expect(screen.getByRole('menuitem', { name: /header widget/i })).toHaveAttribute(
            'href',
            '/help/how-to/widget-header-widget'
        )
        expect(screen.getByRole('menuitem', { name: /header widget/i })).toHaveAttribute('target', '_blank')
        expect(screen.getByText('General widget help')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /add and edit widgets/i })).toHaveAttribute(
            'href',
            '/help/how-to/widgets-edit'
        )
        expect(screen.getByRole('menuitem', { name: /use widget row actions/i })).toHaveAttribute(
            'href',
            '/help/how-to/widgets-toolbar'
        )
        expect(screen.getByText('Global help')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Help home' })).toHaveAttribute(
            'href',
            '/help/how-to'
        )
    })
})
