import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SlotWidgetTypeSelect from '../SlotWidgetTypeSelect'
import { slotWidgetTypeOptions } from '../slotWidgetTypeOptions'

const options = [
    { value: 'easy_widgets.BannerWidget', label: 'Banner', description: 'Display text with an optional image.' },
    { value: 'easy_widgets.HeroWidget', label: 'Hero' },
]
const Harness = ({ initial = [], disabled = false }) => {
    const [value, setValue] = useState(initial)
    return <><SlotWidgetTypeSelect label="Allowed widget types" value={value} onChange={setValue} options={options} disabled={disabled} /><output data-testid="selection">{JSON.stringify(value)}</output></>
}

describe('Slot widget type multi-select', () => {
    it('searches by name and type ID, keeps multiple selections, and removes one at a time', async () => {
        const user = userEvent.setup()
        render(<Harness />)
        const input = screen.getByRole('combobox', { name: 'Allowed widget types' })
        await user.click(input)
        await user.type(input, 'banner')
        await user.click(screen.getByRole('option', { name: /Banner/ }))
        await user.type(input, 'easy_widgets.Hero')
        await user.click(screen.getByRole('option', { name: /Hero/ }))
        expect(screen.getByTestId('selection')).toHaveTextContent('["easy_widgets.BannerWidget","easy_widgets.HeroWidget"]')
        await user.click(screen.getByRole('button', { name: /Remove Banner/ }))
        expect(screen.getByTestId('selection')).toHaveTextContent('["easy_widgets.HeroWidget"]')
        expect(input).toHaveFocus()
    })

    it('supports keyboard selection and Escape without losing the selected value', async () => {
        const user = userEvent.setup()
        render(<Harness />)
        const input = screen.getByRole('combobox', { name: 'Allowed widget types' })
        await user.click(input)
        await user.type(input, 'hero')
        await user.keyboard('{ArrowDown}{Enter}{Escape}')
        expect(screen.getByTestId('selection')).toHaveTextContent('["easy_widgets.HeroWidget"]')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('preserves imported patterns and unavailable types until explicitly removed', async () => {
        const user = userEvent.setup()
        render(<Harness initial={['easy_widgets.*', 'custom.MissingWidget']} />)
        expect(screen.getByTestId('selection')).toHaveTextContent('["easy_widgets.*","custom.MissingWidget"]')
        await user.click(screen.getByRole('button', { name: /Remove Missing \(unavailable\)/ }))
        expect(screen.getByTestId('selection')).toHaveTextContent('["easy_widgets.*"]')
    })

    it('keeps disabled policies read-only', () => {
        render(<Harness initial={['easy_widgets.BannerWidget']} disabled />)
        expect(screen.getByRole('combobox')).toBeDisabled()
        expect(screen.getByRole('button', { name: /Remove Banner/ })).toBeDisabled()
    })

    it('offers built-ins and only released theme widgets from this workspace', () => {
        const result = slotWidgetTypeOptions({ widgetTypes: { version: 1, items: [
            { id: 'local', name: 'Local banner', status: 'active', active_version: 1, releases: [{ version: 1, schema: {}, defaults: {} }] },
            { id: 'draft', name: 'Draft banner', releases: [] },
            { id: 'archived', name: 'Archived', status: 'archived', active_version: 1, releases: [{ version: 1 }] },
        ] } })
        expect(result).toContainEqual(expect.objectContaining({ value: 'easy_widgets.NewsFlashWidget', label: 'News Flash', description: expect.any(String) }))
        expect(result).toContainEqual(expect.objectContaining({ value: 'theme_widgets.local', label: 'Local banner' }))
        expect(result.some(option => option.value === 'theme_widgets.draft' || option.value === 'theme_widgets.archived')).toBe(false)
    })

    it('shows descriptions and keeps technical identifiers in hover titles only', async () => {
        const user = userEvent.setup()
        render(<Harness />)
        await user.click(screen.getByRole('combobox'))
        await user.type(screen.getByRole('combobox'), 'optional image')
        const option = screen.getByRole('option', { name: /Banner/ })
        expect(option).toHaveTextContent('Display text with an optional image.')
        expect(option).toHaveAttribute('title', 'easy_widgets.BannerWidget')
        expect(screen.queryByText('easy_widgets.BannerWidget')).not.toBeInTheDocument()
    })
})
