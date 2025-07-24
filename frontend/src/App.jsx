import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'react-hot-toast'
import { X } from 'lucide-react'
import { useState } from 'react'
import Navbar from '@components/Navbar'
import HomePage from '@pages/HomePage'
import AboutPage from '@pages/AboutPage'
import SettingsManager from '@pages/SettingsManager'
import TreePageManager from '@components/TreePageManager'
import PageEditor from '@components/PageEditor'
import NotFoundPage from '@pages/NotFoundPage'
import { NotificationProvider } from '@components/NotificationManager'

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
  // State for page editor
  const [pageEditorState, setPageEditorState] = useState({
    isOpen: false,
    pageId: null,
    previousView: 'tree'
  })

  // Handle opening page editor
  const handleEditPage = (page, context = {}) => {
    setPageEditorState({
      isOpen: true,
      pageId: page?.id || null,
      previousView: context.previousView || 'tree'
    })
  }

  // Handle closing page editor
  const handleClosePageEditor = () => {
    setPageEditorState({
      isOpen: false,
      pageId: null,
      previousView: 'tree'
    })
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            {/* Main application layout - hidden when page editor is open */}
            {!pageEditorState.isOpen && (
              <>
                <Navbar />
                <main className="container mx-auto px-4 py-8">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/pages" element={
                      <TreePageManager onEditPage={handleEditPage} />
                    } />
                    <Route path="/settings" element={
                      <SettingsManager onEditPage={handleEditPage} />
                    } />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </main>
              </>
            )}

            {/* Page Editor - renders in fullscreen when open */}
            {pageEditorState.isOpen && (
              <PageEditor
                pageId={pageEditorState.pageId}
                onClose={handleClosePageEditor}
                previousView={pageEditorState.previousView}
              />
            )}

            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  zIndex: 9999,
                  maxWidth: '500px',
                  background: '#fff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                },
                success: {
                  style: {
                    background: '#10b981',
                    color: '#fff',
                    border: '1px solid #059669',
                  },
                },
                error: {
                  style: {
                    background: '#ef4444',
                    color: '#fff',
                    border: '1px solid #dc2626',
                  },
                },
              }}
              containerStyle={{
                zIndex: 9999,
              }}
            >
              {(t) => (
                <div
                  style={{
                    ...t.style,
                    zIndex: 9999,
                  }}
                  className="flex items-center justify-between rounded-lg shadow-xl p-4 toast-notification"
                >
                  <div className="flex items-center">
                    {t.icon}
                    <span className="ml-2 font-medium">{t.message}</span>
                  </div>
                  <button
                    onClick={() => toast.remove(t.id)}
                    className="ml-4 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
                    aria-label="Close notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Toaster>
          </div>
        </Router>
      </NotificationProvider>
    </QueryClientProvider>
  )
}

export default App