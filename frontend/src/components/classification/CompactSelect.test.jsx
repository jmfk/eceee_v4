import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CompactSelect from './CompactSelect'

function Example({ onSave = () => {} }) {
    const [value, setValue] = useState('')
    return <form onSubmit={event => { event.preventDefault(); onSave(value) }}>
        <CompactSelect label="Namespace" required value={value} onChange={event => setValue(event.target.value)}>
            <option value="">Choose namespace</option>
            <option value="unavailable" disabled>Unavailable</option>
            <option value="main">Default</option>
        </CompactSelect>
        <button type="submit">Save</button>
    </form>
}

describe('compact select', () => {
    it('supports keyboard selection and skips disabled options', async () => {
        const user = userEvent.setup()
        render(<Example />)
        await user.tab()
        const field = screen.getByRole('combobox', { name: 'Namespace' })
        expect(field).toHaveFocus()
        await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
        expect(field).toHaveTextContent('Default')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(field).toHaveFocus()
    })

    it('preserves required selection validation and permits submission after choosing a value', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        render(<Example onSave={onSave} />)
        await user.click(screen.getByRole('button', { name: 'Save' }))
        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('Choose an option.')
        expect(screen.getByRole('combobox', { name: 'Namespace' })).toHaveFocus()
        await user.click(screen.getByRole('combobox', { name: 'Namespace' }))
        await user.click(await screen.findByRole('option', { name: 'Default' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))
        expect(onSave).toHaveBeenCalledWith('main')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
