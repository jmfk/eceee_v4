import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ThemeColorField } from '../ThemeDesignTokens'

describe('ThemeColorField', () => {
    it('adds a custom picker value to the theme palette and selects its new name', async () => {
        const user = userEvent.setup()
        const onAdd = vi.fn()
        const onChange = vi.fn()
        render(<ThemeColorField
            id="background-color"
            label="Background color"
            value="#112233"
            colors={[{ name: 'brand', value: '#123456' }]}
            onAdd={onAdd}
            onChange={onChange}
        />)

        await user.click(screen.getByRole('button', { name: 'Add this color to theme palette' }))
        await user.type(screen.getByLabelText('New theme color name'), 'accent')
        fireEvent.change(screen.getByLabelText('New theme color value'), { target: { value: '#abcdef' } })
        await user.click(screen.getByRole('button', { name: 'Add to theme' }))

        expect(onAdd).toHaveBeenCalledWith({ name: 'accent', value: '#abcdef' })
        expect(onChange).toHaveBeenCalledWith('accent')
    })
})
