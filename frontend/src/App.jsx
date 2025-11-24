/*
 * Copyright (C) 2025 Johan Mats Fred Karlsson
 *
 * This file is part of easy_v4.
 *
 * This program is licensed under the Server Side Public License, version 1,
 * as published by MongoDB, Inc. See the LICENSE file for details.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'react-hot-toast'
import { X } from 'lucide-react'
import { useState, useEffect } from 'react'
// import './utils/rerenderInvestigation' // Initialize render investigation - DISABLED
import Navbar from '@components/Navbar'
import GlobalWysiwygToolbar from '@components/wysiwyg/GlobalWysiwygToolbar'
import { useAutoPageTitle } from './hooks/useDocumentTitle'

import SettingsManager from '@pages/SettingsManager'
import SystemSchemaPage from '@pages/SystemSchemaPage'
import LayoutSchemaPage from '@pages/LayoutSchemaPage'
import LayoutSchemaEditorPage from '@pages/LayoutSchemaEditorPage'
import MediaManagerPage from '@pages/MediaManagerPage'
import TagsPage from '@pages/TagsPage'
import ProfilePage from '@pages/ProfilePage'
import UserManagementPage from '@pages/UserManagementPage'
import ObjectBrowser from '@components/ObjectBrowser'
import ObjectTypeEditorPage from '@pages/ObjectTypeEditorPage'
import ObjectInstanceEditPage from '@pages/ObjectInstanceEditPage'
import TreePageManager from '@components/TreePageManager'
import PageEditor from '@components/PageEditor'
import VersionTimelinePage from '@pages/VersionTimelinePage'
import NotFoundPage from '@pages/NotFoundPage'
import SelfContainedFormDemo from '@components/demos/SelfContainedFormDemo'
import SimpleFormDemo from '@components/demos/SimpleFormDemo'
import SettingsTabs from '@components/SettingsTabs'
import ImageStyleEditPage from '@pages/theme-styles/ImageStyleEditPage'
import ComponentStyleEditPage from '@pages/theme-styles/ComponentStyleEditPage'
import { NotificationProvider } from '@components/NotificationManager'
import { GlobalNotificationProvider } from './contexts/GlobalNotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { UnifiedDataProvider } from './contexts/unified-data'
import { ClipboardProvider } from './contexts/ClipboardContext'
import PrivateRoute from './components/PrivateRoute'
import LoginPage from './pages/LoginPage'
import StatusBar from './components/StatusBar'
import SessionExpiredOverlay from './components/SessionExpiredOverlay'

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

// Initialize global context menu config
if (typeof window !== 'undefined' && !window.__contextMenuConfig) {
  window.__contextMenuConfig = { enabled: true }
}

const ContextMenuToggle = () => {
  const [enabled, setEnabled] = useState(() => window.__contextMenuConfig?.enabled ?? true)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 75, y: window.innerHeight - 60 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const isDevelopment = import.meta.env.DEV

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setVisible(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    // Update global config
    if (window.__contextMenuConfig) {
      window.__contextMenuConfig.enabled = enabled
    }

    // Also update LayoutRenderer if it exists
    if (window.__layoutRenderer) {
      window.__layoutRenderer.uiConfig.enableContextMenu = enabled
    }
  }, [enabled])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON') return
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  if (!isDevelopment || !visible) return null

  return (
    <div
      className="fixed z-[10020] bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 cursor-move select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onMouseDown={handleMouseDown}
    >
      <span className="text-sm font-medium">Context Menu</span>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-600'
          }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
      </button>
    </div>
  )
}

const AppRoutes = () => {
  useAutoPageTitle()

  return (
    <>
      <ContextMenuToggle />
      <Routes>
        {/* Login route - no authentication required */}
        <Route path="/login" element={<LoginPage />} />

        {/* Main application routes with fixed layout */}
        <Route path="/" element={<Navigate to="/pages" replace />} />

        {/* Self-Contained Form Demo Routes */}
        <Route path="/demo/self-contained-form" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <SelfContainedFormDemo />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Self-Contained Form Demo - Active</span>} />
            </div>
          </PrivateRoute>
        } />

        <Route path="/demo/simple-form" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <SimpleFormDemo />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Simple Form Demo - Active</span>} />
            </div>
          </PrivateRoute>
        } />

        <Route path="/pages" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <GlobalWysiwygToolbar />
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
              <GlobalWysiwygToolbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <MediaManagerPage />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Media Manager - Ready</span>} />
            </div>
          </PrivateRoute>
        } />
        <Route path="/tags" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <TagsPage />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Tags - Ready</span>} />
            </div>
          </PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <ProfilePage />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Profile - Ready</span>} />
            </div>
          </PrivateRoute>
        } />
        <Route path="/settings/users" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <div className="container mx-auto px-4 py-8">
                    <SettingsTabs />
                    <UserManagementPage />
                  </div>
                </div>
              </main>
              <StatusBar customStatusContent={<span>Settings - Users</span>} />
            </div>
          </PrivateRoute>
        } />
        {/* Settings routes with distinct paths */}
        <Route path="/settings" element={<Navigate to="/settings/layouts" replace />} />
        {/* Redirect old tags route to new top-level route */}
        <Route path="/settings/tags" element={<Navigate to="/tags" replace />} />
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
        <Route path="/settings/themes/:themeId" element={
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
        <Route path="/settings/themes/:themeId/:tab" element={
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
        <Route path="/settings/themes/:themeId/image-styles/:styleKey" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <ImageStyleEditPage />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Edit Image Style</span>} />
            </div>
          </PrivateRoute>
        } />
        <Route path="/settings/themes/:themeId/component-styles/:styleKey" element={
          <PrivateRoute>
            <div className="fixed inset-0 bg-gray-50 flex flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <ComponentStyleEditPage />
                </div>
              </main>
              <StatusBar customStatusContent={<span>Edit Component Style</span>} />
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
        <Route path="/settings/value-lists" element={
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
              <StatusBar customStatusContent={<span>Settings - Value Lists</span>} />
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
              <GlobalWysiwygToolbar />
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
              <GlobalWysiwygToolbar />
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
              className="ml-4 p-1 rounded hover:bg-black/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </Toaster>
    </>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <GlobalNotificationProvider>
          <UnifiedDataProvider enableDevTools={true}>
            <ClipboardProvider>
              <AuthProvider>
                <SessionExpiredOverlay />
                <Router>
                  <AppRoutes />
                </Router>
              </AuthProvider>
            </ClipboardProvider>
          </UnifiedDataProvider>
        </GlobalNotificationProvider>
      </NotificationProvider>
    </QueryClientProvider >
  )
}

export default App