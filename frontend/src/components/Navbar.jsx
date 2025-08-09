import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, Code, Cpu, Settings, Grid3X3, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { logout } = useAuth()

  const navigation = [
    { name: 'Home', href: '/', icon: Code },
    { name: 'About', href: '/about', icon: Cpu },
    { name: 'Pages', href: '/pages', icon: Settings },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isSchemasActive = location.pathname.startsWith('/schemas')

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                ECEEE v4
              </span>
            </Link>
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

            {/* Schemas dropdown */}
            <div className="relative"
              onMouseEnter={() => setIsOpen('schemas')}
              onMouseLeave={() => setIsOpen(false)}>
              <button
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isSchemasActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}`}
              >
                <Code className="w-4 h-4" />
                <span>Schemas</span>
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>
              {isOpen === 'schemas' && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <Link
                      to="/schemas/system"
                      className={`block px-4 py-2 text-sm ${location.pathname === '/schemas/system' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      System Schema
                    </Link>
                    <Link
                      to="/schemas/layout"
                      className={`block px-4 py-2 text-sm ${location.pathname === '/schemas/layout' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      Layout Schemas
                    </Link>
                  </div>
                </div>
              )}
            </div>

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

              {/* Mobile Schemas section */}
              <div className="pt-2">
                <div className="px-3 text-xs uppercase tracking-wide text-gray-500">Schemas</div>
                <Link
                  to="/schemas/system"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${location.pathname === '/schemas/system'
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}`}
                >
                  <Code className="w-5 h-5" />
                  <span>System Schema</span>
                </Link>
                <Link
                  to="/schemas/layout"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${location.pathname === '/schemas/layout'
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}`}
                >
                  <Grid3X3 className="w-5 h-5" />
                  <span>Layout Schemas</span>
                </Link>
              </div>

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