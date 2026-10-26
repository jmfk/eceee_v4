import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Navbar from '../Navbar'
import UserToolsNav from '../UserToolsNav'
import { useAuth } from '../../contexts/AuthContext'

vi.mock('../support/useSupportContext', () => ({ useSupportContext: () => ({ data: { unreadCount: 0 } }), useSupportTenant: () => 'a' }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ logout: vi.fn(), user: { username: 'editor' } })),
}))

describe('Navbar', () => {
  let availableWidth
  let menuWidth
  let resizeCallback
  let observers

  const renderNavbar = () => render(
    <MemoryRouter initialEntries={['/pages']}>
      <Navbar />
    </MemoryRouter>,
  )

  const resize = (width) => {
    availableWidth = width
    act(() => resizeCallback())
  }

  beforeEach(() => {
    useAuth.mockReturnValue({ logout: vi.fn(), user: { username: 'editor' } })
    availableWidth = 1200
    menuWidth = 1060
    observers = []
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      // jsdom has no layout; supply intrinsic menu and available row widths.
      const width = this.classList.contains('space-x-8') ? menuWidth : availableWidth
      return { width }
    })
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) {
        resizeCallback = callback
        this.observe = vi.fn()
        this.disconnect = vi.fn()
        observers.push(this)
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the navigation without redundant product branding or page context', () => {
    renderNavbar()

    const pagesLink = screen.getByRole('link', { name: 'Pages' })

    expect(pagesLink).toBeInTheDocument()
    expect(pagesLink.parentElement.parentElement).toHaveClass('justify-start')
    expect(screen.getAllByText('Pages')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'A/B Tests' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tags' })).toHaveAttribute('href', '/tags')
    expect(screen.getByRole('link', { name: 'Designer' })).toHaveAttribute('href', '/designer/themes')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
    for (const name of ['Inbox', 'Kanban']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Report a problem' })).toHaveAttribute('href', expect.stringContaining('/inbox/new?from='))
    expect(screen.queryByText('EASY v4')).not.toBeInTheDocument()
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })

  it('keeps personal tools but hides denied CMS navigation for an empty role', () => {
    useAuth.mockReturnValue({ logout: vi.fn(), user: { permissions: [] } })
    render(<MemoryRouter><Navbar /><UserToolsNav tenant="a" /></MemoryRouter>)
    for (const name of ['Statistics', 'Settings', 'Pages', 'Kanban']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Profile' })).toHaveLength(2)
  })

  it('exposes settings to role managers and Statistics only to its readers', () => {
    useAuth.mockReturnValue({ logout: vi.fn(), user: { permissions: ['roles.manage', 'statistics.read'] } })
    renderNavbar()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Statistics' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pages' })).not.toBeInTheDocument()
  })

  it('stays collapsed across measurements and menu interaction, then expands when space is available', () => {
    availableWidth = 800
    const { unmount } = renderNavbar()
    const navigation = screen.getByRole('navigation')
    const desktopMenu = navigation.querySelector('[inert]')

    expect(navigation).toHaveClass('nav-collapsed')
    expect(desktopMenu).not.toHaveClass('hidden')
    expect(screen.queryByRole('link', { name: 'Pages' })).not.toBeInTheDocument()

    resize(800)
    resize(800)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Pages' })).toBeInTheDocument()
    expect(navigation).toHaveClass('nav-collapsed')
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
    for (const name of ['Inbox', 'Kanban']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledWith(desktopMenu)
    expect(observers[0].observe).toHaveBeenCalledWith(desktopMenu.parentElement)

    resize(1200)
    expect(navigation).not.toHaveClass('nav-collapsed')
    expect(desktopMenu).not.toHaveAttribute('inert')
    expect(screen.getAllByRole('link', { name: 'Pages' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /navigation menu/ })).not.toBeInTheDocument()

    resize(800)
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Pages' })).not.toBeInTheDocument()

    unmount()
    expect(observers[0].disconnect).toHaveBeenCalledOnce()
  })

  it('keeps the desktop menu when Safari reports a spurious pixel of scroll overflow', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1047)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1046)
    availableWidth = 1060
    menuWidth = 1060.5
    renderNavbar()

    resize(1060)
    resize(1060)

    expect(screen.getByRole('navigation')).not.toHaveClass('nav-collapsed')
    expect(screen.getByRole('link', { name: 'Pages' })).toBeInTheDocument()
    expect(observers).toHaveLength(1)
  })

  it('updates the mode when the menu width changes without a container resize', () => {
    renderNavbar()
    menuWidth = 1300
    resize(1200)
    expect(screen.getByRole('navigation')).toHaveClass('nav-collapsed')

    menuWidth = 1060
    resize(1200)
    expect(screen.getByRole('navigation')).not.toHaveClass('nav-collapsed')
  })

  it('closes the collapsed menu after navigation or an outside click', () => {
    availableWidth = 800
    renderNavbar()

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    fireEvent.click(screen.getByRole('link', { name: 'Objects' }))
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    fireEvent.mouseDown(document.body)
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})
