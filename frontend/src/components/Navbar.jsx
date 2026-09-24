import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, Settings, Grid3X3, FolderOpen, Database, Hash, User as UserIcon, BarChart2, Beaker, Palette } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const { logout, user } = useAuth()
  const navRef = useRef(null)
  const desktopNavRef = useRef(null)

  const navigation = [
    { name: 'Pages', href: '/pages', icon: Grid3X3 },
    { name: 'Objects', href: '/objects', icon: Database },
    { name: 'Media', href: '/media', icon: FolderOpen },
    { name: 'Statistics', href: '/statistics', icon: BarChart2 },
    { name: 'A/B Tests', href: '/experiments', icon: Beaker },
    { name: 'Tags', href: '/tags', icon: Hash },
    { name: 'Designer', href: '/designer/themes', icon: Palette },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Profile', href: '/profile', icon: UserIcon },
  ]

  const isSchemasActive = false

  const isActive = (path) => {
    if (path === '/settings') {
      return location.pathname.startsWith('/settings') || location.pathname.startsWith('/schemas')
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  // Overflow detection effect
  useEffect(() => {
    const updateNavMode = () => {
      if (!navRef.current || !desktopNavRef.current) return
      const isOverflowing = desktopNavRef.current.scrollWidth > desktopNavRef.current.clientWidth
      setIsCollapsed(isOverflowing)
    }

    const ro = new ResizeObserver(updateNavMode)
    if (navRef.current) {
      ro.observe(navRef.current)
    }

    updateNavMode() // Initial check

    return () => ro.disconnect()
  }, [navigation])

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
        <div className="flex justify-start h-16">
          {/* Desktop navigation */}
          <div ref={desktopNavRef} className={`items-center space-x-8 ${isCollapsed ? 'hidden' : 'flex'}`}>
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.href)
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            ))}

            {/* Schemas dropdown moved to Settings second-level tabs */}

            {/* Logout button */}
            <button
              onClick={logout}
              className="text-gray-600 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Mobile/Collapsed menu button */}
          <div className={`flex items-center ${isCollapsed ? 'flex' : 'hidden'}`}>
            <button
              onClick={() => setIsOpen(!isOpen)}
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
          <div className="py-4 border-t border-gray-200">
            <div className="space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive(item.href)
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}

              {/* Schemas moved to Settings second-level menu */}

              {/* Mobile logout button */}
              <button
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-red-600 transition-colors w-full text-left"
              >
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
