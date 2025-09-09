import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'react-hot-toast'
import { X } from 'lucide-react'
// import './utils/rerenderInvestigation' // Initialize render investigation - DISABLED
import Navbar from '@components/Navbar'
import HomePage from '@pages/HomePage'

import SettingsManager from '@pages/SettingsManager'
import SystemSchemaPage from '@pages/SystemSchemaPage'
import LayoutSchemaPage from '@pages/LayoutSchemaPage'
import LayoutSchemaEditorPage from '@pages/LayoutSchemaEditorPage'
import MediaManagerPage from '@pages/MediaManagerPage'
import ObjectBrowser from '@components/ObjectBrowser'
import ObjectTypeEditorPage from '@pages/ObjectTypeEditorPage'
import ObjectInstanceEditPage from '@pages/ObjectInstanceEditPage'
import TreePageManager from '@components/TreePageManager'
import PageEditor from '@components/PageEditor'
import VersionTimelinePage from '@pages/VersionTimelinePage'
import NotFoundPage from '@pages/NotFoundPage'
// import RenderInvestigation from '@pages/RenderInvestigation' // DISABLED
import { NotificationProvider } from '@components/NotificationManager'
import { GlobalNotificationProvider } from './contexts/GlobalNotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { WidgetEventProvider } from './contexts/WidgetEventContext'
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
          <WidgetEventProvider>
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

                  {/* RENDER INVESTIGATION ROUTE - DISABLED
                  <Route path="/render-investigation" element={
                    <PrivateRoute>
                      <div className="fixed inset-0 bg-gray-50 flex flex-col">
                        <Navbar />
                        <main className="flex-1 overflow-hidden">
                          <div className="h-full overflow-y-auto">
                            <RenderInvestigation />
                          </div>
                        </main>
                        <StatusBar customStatusContent={<span>Render Investigation - Active</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  */}

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
                  <Route path="/media" element={
                    <PrivateRoute>
                      <div className="fixed inset-0 bg-gray-50 flex flex-col">
                        <Navbar />
                        <main className="flex-1 overflow-hidden">
                          <div className="h-full overflow-y-auto">
                            <MediaManagerPage />
                          </div>
                        </main>
                        <StatusBar customStatusContent={<span>Media Manager - Ready</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  {/* Settings routes with distinct paths */}
                  <Route path="/settings" element={<Navigate to="/settings/layouts" replace />} />
                  <Route path="/settings/layouts" element={
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
                        <StatusBar customStatusContent={<span>Settings - Layouts</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/themes" element={
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
                        <StatusBar customStatusContent={<span>Settings - Themes</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/widgets" element={
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
                        <StatusBar customStatusContent={<span>Settings - Widgets</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/tags" element={
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
                        <StatusBar customStatusContent={<span>Settings - Tags</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/object-types" element={
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
                        <StatusBar customStatusContent={<span>Settings - Object Types</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/versions" element={
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
                        <StatusBar customStatusContent={<span>Settings - Versions</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/publishing" element={
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
                        <StatusBar customStatusContent={<span>Settings - Publishing Workflow</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/settings/namespaces" element={
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
                        <StatusBar customStatusContent={<span>Settings - Namespaces</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/objects" element={
                    <PrivateRoute>
                      <div className="fixed inset-0 bg-gray-50 flex flex-col">
                        <Navbar />
                        <main className="flex-1 overflow-hidden">
                          <div className="h-full overflow-y-auto">
                            <ObjectBrowser />
                          </div>
                        </main>
                        <StatusBar customStatusContent={<span>Object Storage - Ready</span>} />
                      </div>
                    </PrivateRoute>
                  } />
                  <Route path="/objects/:typeName" element={
                    <PrivateRoute>
                      <div className="fixed inset-0 bg-gray-50 flex flex-col">
                        <Navbar />
                        <main className="flex-1 overflow-hidden">
                          <div className="h-full overflow-y-auto">
                            <ObjectBrowser />
                          </div>
                        </main>
                        <StatusBar customStatusContent={<span>Object Storage - Ready</span>} />
                      </div>
                    </PrivateRoute>
                  } />

                  {/* Object Type Editor Routes */}
                  <Route path="/settings/object-types/new/:tab?" element={
                    <PrivateRoute>
                      <ObjectTypeEditorPage />
                    </PrivateRoute>
                  } />
                  <Route path="/settings/object-types/:id/:tab?" element={
                    <PrivateRoute>
                      <ObjectTypeEditorPage />
                    </PrivateRoute>
                  } />

                  {/* Object Instance Editor Routes */}
                  <Route path="/objects/new/:objectTypeId/:tab?" element={<PrivateRoute><ObjectInstanceEditPage /></PrivateRoute>} />
                  <Route path="/objects/:instanceId/edit/:tab?" element={<PrivateRoute><ObjectInstanceEditPage /></PrivateRoute>} />

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
                  <Route path="/schemas/layout/:layoutName" element={
                    <PrivateRoute>
                      <div className="fixed inset-0 bg-gray-50 flex flex-col">
                        <Navbar />
                        <main className="flex-1 overflow-hidden">
                          <div className="h-full overflow-y-auto">
                            <LayoutSchemaEditorPage />
                          </div>
                        </main>
                        <StatusBar customStatusContent={<span>Layout Schema Editor - Ready</span>} />
                      </div>
                    </PrivateRoute>
                  } />

                  {/* Page editor routes - fullscreen without navbar */}
                  <Route path="/pages/:pageId/edit/:tab" element={<PrivateRoute><WidgetEventProvider><PageEditor /></WidgetEventProvider></PrivateRoute>} />
                  <Route path="/pages/:pageId/edit" element={<PrivateRoute><WidgetEventProvider><PageEditor /></WidgetEventProvider></PrivateRoute>} />
                  <Route path="/pages/new/:tab" element={<PrivateRoute><WidgetEventProvider><PageEditor /></WidgetEventProvider></PrivateRoute>} />
                  <Route path="/pages/new" element={<PrivateRoute><WidgetEventProvider><PageEditor /></WidgetEventProvider></PrivateRoute>} />

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
          </WidgetEventProvider>
        </GlobalNotificationProvider>
      </NotificationProvider>
    </QueryClientProvider>
  )
}

export default App