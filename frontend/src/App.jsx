import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'react-hot-toast'
import { X } from 'lucide-react'
import Navbar from '@components/Navbar'
import HomePage from '@pages/HomePage'
import AboutPage from '@pages/AboutPage'
import SettingsManager from '@pages/SettingsManager'
import TreePageManager from '@components/TreePageManager'
import NotFoundPage from '@pages/NotFoundPage'

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pages" element={<TreePageManager />} />
              <Route path="/settings" element={<SettingsManager />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Toaster
            position="top-center"
          >
            {(t) => (
              <div style={t.style} className="flex items-center justify-between bg-green-400 border border-green-800 rounded-lg shadow-lg p-4">
                <div className="flex items-center">
                  {t.icon}
                  <span className="ml-2">{t.message}</span>
                </div>
                <button
                  onClick={() => toast.remove(t.id)}
                  className="ml-4 p-1 rounded hover:bg-green-500 transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </Toaster>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App