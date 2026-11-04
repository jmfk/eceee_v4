import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import ConfirmationModal from '../ConfirmationModal'

it('places a widget confirmation above editor stacking contexts', () => {
    const { container } = render(
        <div style={{ transform: 'scale(0.8)', zIndex: 1 }}>
            <ConfirmationModal
                isOpen
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                title="Delete Widget"
                message="Delete this widget?"
            />
        </div>
    )

    const dialog = screen.getByRole('dialog', { name: 'Delete Widget' })
    expect(dialog.parentElement).toBe(document.body)
    expect(container.contains(dialog)).toBe(false)
    expect(dialog).toHaveClass('z-[10060]')
})
