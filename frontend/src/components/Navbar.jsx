import { canAccessCmsPath } from '../utils/cmsNavigation'
import { useSupportContext } from './support/useSupportContext'
import { safeReportLocation } from '../api/support'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, Settings, Grid3X3, FolderOpen, Database, Hash, User as UserIcon, BarChart2, Palette, Flag } from 'lucide-react'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { cmsText } from '../utils/cmsCopy'

const navigation = [
  { name: 'Pages', href: '/pages', icon: Grid3X3 },
  { name: 'Objects', href: '/objects', icon: Database },
  { name: 'Media', href: '/media', icon: FolderOpen },
  { name: 'Statistics', href: '/statistics', icon: BarChart2 },
  { name: 'Tags', href: '/tags', icon: Hash },
  { name: 'Designer', href: '/designer/themes', icon: Palette, Flag },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Profile', href: '/profile', icon: UserIcon },
]

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const support = useSupportContext()
  const inboxCount = support.data?.unreadCount || 0
  const { user, language } = useAuth()
  const t = (key) => cmsText(key, language)
  const supportSettingsOnly = support.data?.canSupport && !support.data?.canManage && !canAccessCmsPath(user, '/settings')
  const scopedTenant = new URLSearchParams(location.search).get('tenant')
  const settingsHref = scopedTenant ? `/settings?tenant=${encodeURIComponent(scopedTenant)}` : '/settings'
  const supportSettingsHref = scopedTenant ? `/settings/support?tenant=${encodeURIComponent(scopedTenant)}` : '/settings/support'
  const visibleNavigation = navigation.filter((item) =>
    canAccessCmsPath(user, item.href) || (item.href === '/settings' && (support.data?.canSupport || support.data?.canManage)))
  const navRef = useRef(null)
  const navContainerRef = useRef(null)
  const desktopNavRef = useRef(null)

  const isActive = (path) => {
    if (path === '/settings') {
      return location.pathname.startsWith('/settings') || location.pathname.startsWith('/schemas')
    }
    if (path === '/profile') {
      return ['/profile', '/inbox', '/kanban'].some((section) =>
        location.pathname === section || location.pathname.startsWith(section + '/'))
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  useLayoutEffect(() => {
    const container = navContainerRef.current
    const desktopNav = desktopNavRef.current
    if (!container || !desktopNav) return

    const updateNavMode = () => {
      // Compare stable, fractional widths: Safari can round scrollWidth and
      // clientWidth differently, even when the menu fits comfortably.
      const isOverflowing = desktopNav.getBoundingClientRect().width > container.getBoundingClientRect().width + 1
      setIsCollapsed(isOverflowing)
      if (!isOverflowing) setIsOpen(false)
    }

    const ro = new ResizeObserver(updateNavMode)
    ro.observe(container)
    ro.observe(desktopNav)

    updateNavMode()

    return () => ro.disconnect()
  }, [])

  // Click outside handler for mobile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <nav ref={navRef} className={`bg-white shadow-sm border-b border-gray-200 ${isCollapsed ? 'nav-collapsed' : ''}`}>
      <div className="container mx-auto px-4">
        <div ref={navContainerRef} className="relative flex justify-start h-16 overflow-hidden">
          {/* Desktop navigation */}
          {/* Keep the collapsed menu measurable without exposing its links. */}
          <div
            ref={desktopNavRef}
            className={`flex w-max shrink-0 items-center space-x-8 ${isCollapsed ? 'invisible absolute inset-y-0 left-0' : ''}`}
            aria-hidden={isCollapsed}
            inert={isCollapsed}
          >
            {visibleNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href === '/settings' ? (supportSettingsOnly ? supportSettingsHref : settingsHref) : item.href}
                state={item.name === 'Profile' ? { reportFrom: location.state?.reportFrom || safeReportLocation(window.location.href) } : undefined}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.href)
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{t(item.name)}{item.name === 'Profile' && inboxCount > 0 ? ` (${inboxCount})` : ''}</span>
              </Link>
            ))}

            {/* Schemas dropdown moved to Settings second-level tabs */}

            {!['/profile', '/inbox', '/kanban'].some((path) => location.pathname.startsWith(path)) && <Link className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600" to={`/inbox/new?from=${encodeURIComponent(safeReportLocation(window.location.href))}`}><Flag size={16} />{t('Report a problem')}</Link>}
          </div>

          {/* Mobile/Collapsed menu button */}
          <div className={`flex items-center ${isCollapsed ? 'flex' : 'hidden'}`} aria-hidden={!isCollapsed} inert={!isCollapsed}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? t('Close navigation menu') : t('Open navigation menu')}
              aria-expanded={isOpen}
              aria-controls="cms-mobile-navigation"
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile/Collapsed navigation */}
        {isOpen && isCollapsed && (
          <div id="cms-mobile-navigation" className="py-4 border-t border-gray-200">
            <div className="space-y-2">
              {!['/profile', '/inbox', '/kanban'].some((path) => location.pathname.startsWith(path)) && <Link className="px-3 py-2 text-sm text-gray-600" to={`/inbox/new?from=${encodeURIComponent(safeReportLocation(window.location.href))}`} onClick={() => setIsOpen(false)}>{t('Report a problem')}</Link>}
              {visibleNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href === '/settings' ? (supportSettingsOnly ? supportSettingsHref : settingsHref) : item.href}
                  state={item.name === 'Profile' ? { reportFrom: location.state?.reportFrom || safeReportLocation(window.location.href) } : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive(item.href)
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{t(item.name)}{item.name === 'Profile' && inboxCount > 0 ? ` (${inboxCount})` : ''}</span>
                </Link>
              ))}

              {/* Schemas moved to Settings second-level menu */}

            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
