import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'react-hot-toast'
import { X } from 'lucide-react'
import Navbar from '@components/Navbar'
import HomePage from '@pages/HomePage'
import AboutPage from '@pages/AboutPage'
import SettingsManager from '@pages/SettingsManager'
import SystemSchemaPage from '@pages/SystemSchemaPage'
import LayoutSchemaPage from '@pages/LayoutSchemaPage'
import TreePageManager from '@components/TreePageManager'
import PageEditor from '@components/PageEditor'
import VersionTimelinePage from '@pages/VersionTimelinePage'
import NotFoundPage from '@pages/NotFoundPage'
import { NotificationProvider } from '@components/NotificationManager'
import { GlobalNotificationProvider } from './contexts/GlobalNotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import LoginPage from './pages/LoginPage'
import StatusBar from './components/StatusBar'

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
      <NotificationProvider>
        <GlobalNotificationProvider>
          <AuthProvider>
            <Router>
              <Routes>
                {/* Login route - no authentication required */}
                <Route path="/login" element={<LoginPage />} />

                {/* Main application routes with fixed layout */}
                <Route path="/" element={
                  <PrivateRoute>
                    <div className="fixed inset-0 bg-gray-50 flex flex-col">
                      <Navbar />
                      <main className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          <div className="container mx-auto px-4 py-8">
                            <HomePage />
                          </div>
                        </div>
                      </main>
                      <StatusBar customStatusContent={<span>Home - Ready</span>} />
                    </div>
                  </PrivateRoute>
                } />
                <Route path="/about" element={
                  <PrivateRoute>
                    <div className="fixed inset-0 bg-gray-50 flex flex-col">
                      <Navbar />
                      <main className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          <div className="container mx-auto px-4 py-8">
                            <AboutPage />
                          </div>
                        </div>
                      </main>
                      <StatusBar customStatusContent={<span>About - Ready</span>} />
                    </div>
                  </PrivateRoute>
                } />
                <Route path="/pages" element={
                  <PrivateRoute>
                    <div className="fixed inset-0 bg-gray-50 flex flex-col">
                      <Navbar />
                      <main className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          <div className="container mx-auto px-4 py-8">
                            <TreePageManager />
                          </div>
                        </div>
                      </main>
                      <StatusBar customStatusContent={<span>Pages Management - Ready</span>} />
                    </div>
                  </PrivateRoute>
                } />
                <Route path="/settings" element={
                  <PrivateRoute>
                    <div className="fixed inset-0 bg-gray-50 flex flex-col">
                      <Navbar />
                      <main className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          <div className="container mx-auto px-4 py-8">
                            <SettingsManager />
                          </div>
                        </div>
                      </main>
                      <StatusBar customStatusContent={<span>Settings - Ready</span>} />
                    </div>
                  </PrivateRoute>
                } />

                {/* Dedicated schema routes */}
                <Route path="/schemas/system" element={
                  <PrivateRoute>
                    <div className="fixed inset-0 bg-gray-50 flex flex-col">
                      <Navbar />
                      <main className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          <SystemSchemaPage />
                        </div>
                      </main>
                      <StatusBar customStatusContent={<span>System Schema - Ready</span>} />
                    </div>
                  </PrivateRoute>
                } />
                <Route path="/schemas/layout" element={
                  <PrivateRoute>
                    <div className="fixed inset-0 bg-gray-50 flex flex-col">
                      <Navbar />
                      <main className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          <LayoutSchemaPage />
                        </div>
                      </main>
                      <StatusBar customStatusContent={<span>Layout Schemas - Ready</span>} />
                    </div>
                  </PrivateRoute>
                } />

                {/* Page editor routes - fullscreen without navbar */}
                <Route path="/pages/:pageId/edit/:tab" element={<PrivateRoute><PageEditor /></PrivateRoute>} />
                <Route path="/pages/:pageId/edit" element={<PrivateRoute><PageEditor /></PrivateRoute>} />
                <Route path="/pages/new/:tab" element={<PrivateRoute><PageEditor /></PrivateRoute>} />
                <Route path="/pages/new" element={<PrivateRoute><PageEditor /></PrivateRoute>} />

                {/* Version timeline page - fullscreen without navbar */}
                <Route path="/pages/:pageId/versions" element={<PrivateRoute><VersionTimelinePage /></PrivateRoute>} />

                {/* 404 route */}
                <Route path="*" element={
                  <div className="fixed inset-0 bg-gray-50 flex flex-col">
                    <Navbar />
                    <main className="flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto">
                        <div className="container mx-auto px-4 py-8">
                          <NotFoundPage />
                        </div>
                      </div>
                    </main>
                    <StatusBar customStatusContent={<span>Page Not Found</span>} />
                  </div>
                } />
              </Routes>

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
            </Router>
          </AuthProvider>
        </GlobalNotificationProvider>
      </NotificationProvider>
    </QueryClientProvider>
  )
}

export default App