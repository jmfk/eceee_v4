import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, Code, Settings, Grid3X3, ChevronDown, FolderOpen, Database, Hash } from 'lucide-react'
import { useState } from 'react'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { logout } = useAuth()

  const navigation = [
    { name: 'Pages', href: '/pages', icon: Grid3X3 },
    { name: 'Objects', href: '/objects', icon: Database },
    { name: 'Media', href: '/media', icon: FolderOpen },
    { name: 'Tags', href: '/tags', icon: Hash },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isSchemasActive = false

  const isActive = (path) => {
    if (path === '/settings') {
      return location.pathname.startsWith('/settings') || location.pathname.startsWith('/schemas')
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const getCurrentContext = () => {
    const path = location.pathname
    if (path.startsWith('/settings/')) {
      const section = path.split('/')[2]
      const sectionNames = {
        'layouts': 'Layouts',
        'themes': 'Themes',
        'widgets': 'Widgets',
        'object-types': 'Object Types',
        'versions': 'Versions',
        'publishing': 'Publishing',
        'namespaces': 'Namespaces'
      }
      return sectionNames[section] || 'Settings'
    }
    if (path.startsWith('/schemas/')) {
      const section = path.split('/')[2]
      const sectionNames = {
        'system': 'System Schema',
        'layout': 'Layout Schemas'
      }
      return sectionNames[section] || 'Schemas'
    }
    if (path.startsWith('/pages')) return 'Pages'
    if (path.startsWith('/objects')) return 'Objects'
    if (path.startsWith('/media')) return 'Media'
    if (path.startsWith('/tags')) return 'Tags'
    return ''
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link to="/pages" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                ECEEE v4
              </span>
            </Link>

            {/* Context Indicator */}
            {getCurrentContext() && (
              <div className="ml-4 flex items-center text-sm text-gray-500">
                <span className="mx-2">›</span>
                <span className="font-medium">{getCurrentContext()}</span>
              </div>
            )}
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-8">
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

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
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

        {/* Mobile navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
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