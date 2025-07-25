import { useState, useEffect } from 'react'
import {
  Code,
  Database,
  Layers,
  Zap,
  Brain,
  GitBranch,
  Container,
  Monitor
} from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'

const HomePage = () => {
  const [apiStatus, setApiStatus] = useState('checking')
  const { addNotification } = useGlobalNotifications()

  // Check API connection on component mount (only once)
  useEffect(() => {
    checkApiConnection()
  }, [])

  // Welcome notification (only once on mount)
  useEffect(() => {
    addNotification('Welcome to eceee_v4 development environment', 'info', 'page-load')
  }, []) // Empty dependency array - runs only once on mount

  // Add notification for page visibility changes (throttled)
  useEffect(() => {
    let lastNotification = 0
    const throttleDelay = 2000 // 2 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastNotification > throttleDelay) {
          addNotification('Homepage tab focused', 'info', 'page-focus')
          lastNotification = now
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, []) // Empty dependency - addNotification is now stable

  // Handle external link navigation with notifications
  const handleAdminClick = () => {
    addNotification('Opening Django Admin interface...', 'info', 'navigation')
    window.open('/admin/', '_blank', 'noopener,noreferrer')
  }

  const handleApiDocsClick = () => {
    addNotification('Opening API documentation...', 'info', 'navigation')
    window.open('/api/docs/', '_blank', 'noopener,noreferrer')
  }

  const checkApiConnection = async () => {
    addNotification('Checking API connection...', 'info', 'api-check')
    try {
      // Use backend directly since we removed the proxy
      const response = await fetch('/health/')
      if (response.ok) {
        setApiStatus('connected')
        addNotification('Backend API connection established', 'success', 'api-connection')
      } else {
        setApiStatus('error')
        addNotification('API connection failed', 'error', 'api-connection')
      }
    } catch (error) {
      setApiStatus('error')
      addNotification('API connection failed', 'error', 'api-connection')
      console.error('API connection failed:', error)
    }
  }

  const features = [
    {
      icon: Code,
      title: 'Django Backend',
      description: 'Robust API with Django REST Framework, PostgreSQL integration, and comprehensive authentication.',
      status: 'configured'
    },
    {
      icon: Layers,
      title: 'React Frontend',
      description: 'Modern React application with Vite, Tailwind CSS, and optimized development workflow.',
      status: 'configured'
    },
    {
      icon: Database,
      title: 'PostgreSQL Database',
      description: 'Production-ready database with proper indexing, migrations, and development seed data.',
      status: 'configured'
    },
    {
      icon: Container,
      title: 'Docker Environment',
      description: 'Containerized development environment with hot reloading and consistent deployment.',
      status: 'configured'
    },
    {
      icon: Brain,
      title: 'AI Integration',
      description: 'MCP servers for filesystem, Git, GitHub, and database operations with AI assistance.',
      status: 'pending'
    },
    {
      icon: GitBranch,
      title: 'Version Control',
      description: 'Git integration with automated workflows, branch management, and collaborative development.',
      status: 'configured'
    },
    {
      icon: Zap,
      title: 'HTMX Integration',
      description: 'Server-side rendering with dynamic interactions for enhanced user experience.',
      status: 'pending'
    },
    {
      icon: Monitor,
      title: 'Monitoring & Testing',
      description: 'Comprehensive testing framework, performance monitoring, and development tools.',
      status: 'pending'
    }
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case 'configured':
        return 'text-green-600 bg-green-100'
      case 'pending':
        return 'text-amber-600 bg-amber-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getApiStatusIndicator = () => {
    switch (apiStatus) {
      case 'connected':
        return <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
      case 'error':
        return <div className="w-3 h-3 bg-red-400 rounded-full"></div>
      default:
        return <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          ECEEE v4 Development Environment
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          AI-integrated development environment with Django, React, PostgreSQL, and comprehensive tooling
          for modern web application development.
        </p>

        {/* API Status Indicator */}
        <div className="flex items-center justify-center space-x-2 mt-4">
          {getApiStatusIndicator()}
          <span className="text-sm text-gray-600">
            Backend API: {apiStatus === 'connected' ? 'Connected' : apiStatus === 'error' ? 'Disconnected' : 'Checking...'}
          </span>
          <button
            onClick={checkApiConnection}
            className="text-primary-600 hover:text-primary-700 text-sm underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <div key={index} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <feature.icon className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(feature.status)}`}>
                    {feature.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleAdminClick}
            className="btn-primary text-center block"
          >
            Django Admin
          </button>
          <button
            onClick={handleApiDocsClick}
            className="btn-secondary text-center block"
          >
            API Documentation
          </button>
          <button
            onClick={() => addNotification('Development environment is ready!', 'success', 'test-notification')}
            className="btn-secondary"
          >
            Test Notifications
          </button>
        </div>
      </div>

      {/* Development Status */}
      <div className="bg-gradient-primary rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Development Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">✅ Completed</h3>
            <ul className="space-y-1 text-sm opacity-90">
              <li>• Project structure and Git repository</li>
              <li>• Docker Compose configuration</li>
              <li>• Django backend with REST API</li>
              <li>• React frontend with Tailwind CSS</li>
              <li>• PostgreSQL database setup</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">🚧 In Progress</h3>
            <ul className="space-y-1 text-sm opacity-90">
              <li>• MCP servers installation</li>
              <li>• HTMX integration</li>
              <li>• Testing frameworks</li>
              <li>• Development workflow tools</li>
              <li>• Documentation and guides</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage