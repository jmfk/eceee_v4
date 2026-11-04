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
    const onChooseWarning = vi.fn()
    const onSaveAcknowledged = vi.fn()
    const item = { id: 'hidden-widget', title: 'Content warning', detail: 'This widget will not appear publicly.', warning: true }
    const { rerender } = render(<ErrorTodoSidebar items={[item]} onChooseWarning={onChooseWarning} onSaveAcknowledged={onSaveAcknowledged} />)

    expect(screen.getByRole('button', { name: 'Save choices' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChooseWarning).toHaveBeenCalledWith('hidden-widget', 'keep')

    rerender(<ErrorTodoSidebar items={[item]} warningChoices={{ 'hidden-widget': 'keep' }} onChooseWarning={onChooseWarning} onSaveAcknowledged={onSaveAcknowledged} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save choices' }))
    expect(onSaveAcknowledged).toHaveBeenCalledOnce()
})

it('offers the explicit slot conversion from a content warning', () => {
    const onChooseWarning = vi.fn()
    const item = { id: 'old-slot', title: 'Content warning', detail: 'Legacy slot is hidden.', warning: true, slotConversion: { from: 'landing_page', layout: 'landingPage', to: 'landingPage' } }
    const { rerender } = render(<ErrorTodoSidebar items={[item]} onChooseWarning={onChooseWarning} occupiedSlots={{ landingPage: true }} />)
    expect(screen.getByText(/remove the hidden landing_page widgets/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Convert to landingPage/ }))
    expect(onChooseWarning).toHaveBeenCalledWith('old-slot', 'convert')
    rerender(<ErrorTodoSidebar items={[item]} warningChoices={{ 'old-slot': 'convert' }} onChooseWarning={onChooseWarning} />)
    expect(screen.getByRole('checkbox', { name: /Keep unchanged for this save/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /ignore this warning for this page/ })).not.toBeChecked()
})
