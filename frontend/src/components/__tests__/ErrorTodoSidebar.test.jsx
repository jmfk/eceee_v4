import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ErrorTodoSidebar from '../ErrorTodoSidebar'

it('shows current save issues without a checkbox that pretends to resolve validation', () => {
    render(<ErrorTodoSidebar items={[{
        id: 'legacy-widget',
        title: 'Validation error',
        detail: "Widget type 'easy_widgets.ContentWidget' is not allowed in slot 'landing_page'.",
    }]} />)

    expect(screen.getByText(/ContentWidget/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('requires every content warning to be acknowledged before saving anyway', () => {
    const onToggleWarning = vi.fn()
    const onSaveAcknowledged = vi.fn()
    const item = { id: 'hidden-widget', title: 'Content warning', detail: 'This widget will not appear publicly.', warning: true }
    const { rerender } = render(<ErrorTodoSidebar items={[item]} onToggleWarning={onToggleWarning} onSaveAcknowledged={onSaveAcknowledged} />)

    expect(screen.getByRole('button', { name: 'Save anyway' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggleWarning).toHaveBeenCalledWith('hidden-widget')

    rerender(<ErrorTodoSidebar items={[item]} acknowledgedWarnings={['hidden-widget']} onToggleWarning={onToggleWarning} onSaveAcknowledged={onSaveAcknowledged} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }))
    expect(onSaveAcknowledged).toHaveBeenCalledOnce()
})
