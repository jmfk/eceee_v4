import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import FieldHelpPopover from '../FieldHelpPopover'

describe('FieldHelpPopover', () => {
    it('reveals help from the info button and closes it with Escape', async () => {
        const user = userEvent.setup()
        render(
            <FieldHelpPopover id="example-help" label="Example">
                Helpful details
            </FieldHelpPopover>
        )

        const button = screen.getByRole('button', { name: 'About Example' })
        let help = screen.getByRole('note', { hidden: true })

        expect(button).toHaveAttribute('aria-controls', 'example-help')
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(help).toHaveClass('sr-only')

        await user.click(button)

        help = screen.getByRole('note')
        expect(button).toHaveAttribute('aria-expanded', 'true')
        expect(help).not.toHaveClass('sr-only')

        await user.keyboard('{Escape}')

        help = screen.getByRole('note', { hidden: true })
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(help).toHaveClass('sr-only')
        expect(button).toHaveFocus()
    })

    it('closes when focus moves to another control', async () => {
        const user = userEvent.setup()
        render(
            <div>
                <FieldHelpPopover label="Example">Helpful details</FieldHelpPopover>
                <button type="button">Next</button>
            </div>
        )

        const helpButton = screen.getByRole('button', { name: 'About Example' })
        await user.click(helpButton)
        await user.click(screen.getByRole('button', { name: 'Next' }))

        expect(helpButton).toHaveAttribute('aria-expanded', 'false')
    })
})
