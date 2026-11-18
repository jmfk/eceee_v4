import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MediaSearchWidget from '../MediaSearchWidget'

vi.mock('../../../api', () => ({ mediaApi: {} }))

describe('MediaSearchWidget image origin', () => {
    it('offers the three origin choices and clears a selected filter', async () => {
        const changeOrigin = vi.fn()
        const { rerender } = render(<MediaSearchWidget onImageOriginChange={changeOrigin} />)
        await userEvent.click(screen.getByRole('button', { name: 'Filter by image origin' }))
        expect(await screen.findByRole('menuitem', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'AI' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Not AI' }))
        expect(changeOrigin).toHaveBeenCalledWith(false)

        rerender(<MediaSearchWidget imageOrigin={false} onImageOriginChange={changeOrigin} />)
        fireEvent.click(screen.getByRole('button', { name: 'Clear image origin filter' }))
        expect(changeOrigin).toHaveBeenLastCalledWith(null)
    })
})
