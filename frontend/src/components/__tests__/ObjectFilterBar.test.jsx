import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import ObjectFilterBar from '../ObjectFilterBar'

it('offers archived objects in the status filter', () => {
    const onStatusesChange = vi.fn()
    render(<QueryClientProvider client={new QueryClient()}>
        <ObjectFilterBar search="" onSearchChange={vi.fn()} statuses={[]} onStatusesChange={onStatusesChange}
            filters={[]} onFiltersChange={vi.fn()} />
    </QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Filter by status' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Archived' }))
    expect(onStatusesChange).toHaveBeenCalledWith(['archived'])
})
