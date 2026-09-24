import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import Navbar from '../Navbar'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { username: 'editor' } }),
}))

describe('Navbar', () => {
  it('shows the navigation without redundant product branding or page context', () => {
    render(
      <MemoryRouter initialEntries={['/pages']}>
        <Navbar />
      </MemoryRouter>,
    )

    const pagesLink = screen.getByRole('link', { name: 'Pages' })

    expect(pagesLink).toBeInTheDocument()
    expect(pagesLink.parentElement.parentElement).toHaveClass('justify-start')
    expect(screen.getAllByText('Pages')).toHaveLength(1)
    expect(screen.queryByText('EASY v4')).not.toBeInTheDocument()
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })
})
