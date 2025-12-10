import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const NotFoundPage = () => {
  // Set document title
  useDocumentTitle('Page Not Found')
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6">
        {/* 404 Text */}
        <div className="space-y-2">
          <div className="text-9xl font-bold text-primary-600" role="heading" aria-level="1">404</div>
          <div className="text-3xl font-bold text-gray-900" role="heading" aria-level="2">Page Not Found</div>
          <div className="text-lg text-gray-600 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. 
            It might have been moved, deleted, or you entered the wrong URL.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            to="/" 
            className="btn-primary flex items-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </Link>
          
          <button 
            onClick={() => window.history.back()} 
            className="btn-secondary flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Help Text */}
        <div className="text-sm text-gray-500">
          <div>If you believe this is an error, please contact the development team.</div>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage