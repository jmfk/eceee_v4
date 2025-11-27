import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    FileText,
    Layers,
    Palette,
    Settings,
    Grid3X3,
    Eye,
    Plus,
    Search,
    History,
    Link,
    Calendar,
    Clock,
    Edit3,
    Save,
    X,
    Trash2,
    Filter,
    ChevronDown,
    Copy,
    Code,
    Database,
    FolderOpen
} from 'lucide-react'
import { api } from '../api/client.js'
import { layoutsApi } from '../api/layouts'
import { useNotificationContext } from '../components/NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import LayoutEditor from '../components/LayoutEditor'
import SettingsTabs from '../components/SettingsTabs'
import ThemeEditor from '../components/ThemeEditor'
import StatusBar from '../components/StatusBar'

import VersionManager from '../components/VersionManager'

import PublicationStatusDashboard from '../components/PublicationStatusDashboard'
import PublicationTimeline from '../components/PublicationTimeline'
import BulkPublishingOperations from '../components/BulkPublishingOperations'
import NamespaceManager from '../components/NamespaceManager'
import ObjectTypeManager from '../components/ObjectTypeManager'
import WidgetManager from '../components/WidgetManager'
import ValueListEditor from '../components/ValueListEditor'
import { extractErrorMessage } from '../utils/errorHandling.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
// Schema managers are no longer embedded in Settings; use dedicated pages under /schemas

const SettingsManager = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()

    // Get tab from URL path, default to 'layouts'
    const getActiveTabFromPath = () => {
        const path = location.pathname
        if (path.startsWith('/settings/themes')) return 'themes'
        if (path === '/settings/widgets') return 'widgets'
        if (path === '/settings/value-lists') return 'value-lists'
        if (path === '/settings/object-types') return 'object-types'
        if (path === '/settings/versions') return 'versions'
        if (path === '/settings/publishing') return 'publishing'
        if (path === '/settings/namespaces') return 'namespaces'
        return 'layouts' // default for /settings/layouts or fallback
    }

    const activeTab = getActiveTabFromPath()

    // Set document title based on active tab
    const tabTitles = {
        'layouts': 'Settings - Layouts',
        'themes': 'Settings - Themes',
        'widgets': 'Settings - Widgets',
        'value-lists': 'Settings - Value Lists',
        'object-types': 'Settings - Object Types',
        'versions': 'Settings - Versions',
        'publishing': 'Settings - Publishing',
        'namespaces': 'Settings - Namespaces'
    }
    useDocumentTitle(tabTitles[activeTab] || 'Settings')
    const [selectedPage, setSelectedPage] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showVersionManager, setShowVersionManager] = useState(false)
    // Get publishing sub-tab from URL search params, default to 'dashboard'
    const publishingView = searchParams.get('publishingView') || 'dashboard'
    const [isCreating, setIsCreating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [layoutFilter, setLayoutFilter] = useState('all')
    const [showFilters, setShowFilters] = useState(false)
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // UDC integration for theme editing
    const { state, useExternalChanges } = useUnifiedData()
    const [themeSaveHandler, setThemeSaveHandler] = useState(null)
    const [isThemeDirty, setIsThemeDirty] = useState(false)

    // Subscribe to UDC changes for theme dirty state
    useExternalChanges('settings-manager', useCallback((udcState) => {
        setIsThemeDirty(udcState.metadata.isThemeDirty || false);
    }, []));

    // Fetch pages
    const { data: pagesResponse, isLoading: pagesLoading } = useQuery({
        queryKey: ['pages'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/pages/')
            return response.data
        }
    })

    // Fetch all layouts for filtering
    const { data: allLayouts } = useQuery({
        queryKey: ['layouts', 'all'],
        queryFn: () => layoutsApi.combined.listAll()
    })

    // Extract pages array from paginated response
    const pages = pagesResponse?.results || []

    // Filter pages based on search and filters
    const filteredPages = pages.filter(page => {
        const normalizedSearchTerm = (searchTerm ?? '').toString().toLowerCase()
        const normalizedTitle = (page?.title ?? '').toString().toLowerCase()
        const normalizedSlug = (page?.slug ?? '').toString().toLowerCase()

        const matchesSearch =
            normalizedTitle.includes(normalizedSearchTerm) ||
            normalizedSlug.includes(normalizedSearchTerm)

        const matchesStatus = statusFilter === 'all' || page.publicationStatus === statusFilter

        const matchesLayout =
            layoutFilter === 'all' ||
            (layoutFilter === 'none' && !page.codeLayout) ||
            (layoutFilter.startsWith('code:') && page.codeLayout === layoutFilter.split(':')[1])

        return matchesSearch && matchesStatus && matchesLayout
    })

    // Get available layouts for filter dropdown
    const getAvailableLayoutsForFilter = () => {
        const options = [
            { value: 'all', label: 'All Layouts', type: 'system' },
            { value: 'none', label: 'No Layout', type: 'system' }
        ]

        if (allLayouts) {
            // Add code layouts
            if (allLayouts.codeLayouts) {
                allLayouts.codeLayouts.forEach(layout => {
                    options.push({
                        value: `code:${layout.name}`,
                        label: `📝 ${layout.name}`,
                        type: 'code'
                    })
                })
            }
        }

        return options
    }

    const availableLayoutOptions = getAvailableLayoutsForFilter()

    // Note: schemas tab has been removed. Use /schemas pages.

    // Add these mutations for creating and updating pages
    const createPageMutation = useMutation({
        mutationFn: async (pageData) => {
            const response = await api.post('/api/v1/webpages/pages/', pageData)
            return response.data
        },
        onSuccess: () => {
            addNotification('Page created successfully', 'success', 'page-create')
            setIsCreating(false)
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            addNotification('Failed to create page', 'error', 'page-create')
        }
    })

    const updatePageMutation = useMutation({
        mutationFn: async ({ id, ...pageData }) => {
            const response = await api.patch(`/api/v1/webpages/pages/${id}/`, pageData)
            return response.data
        },
        onSuccess: () => {
            addNotification('Page updated successfully', 'success', 'page-update')
            setIsEditing(false)
            setSelectedPage(null)
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            addNotification('Failed to update page', 'error', 'page-update')
        }
    })

    const deletePageMutation = useMutation({
        mutationFn: async (pageId) => {
            const response = await api.delete(`/api/v1/webpages/pages/${pageId}/`)
            return response.data
        },
        onSuccess: () => {
            addNotification('Page deleted successfully', 'success', 'page-delete')
            setSelectedPage(null)
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            addNotification('Failed to delete page', 'error', 'page-delete')
        }
    })

    const handleDeletePage = async (page) => {
        const confirmed = await showConfirm({
            title: 'Delete Page',
            message: `Are you sure you want to delete "${page.title}"? This action cannot be undone.`,
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (confirmed) {
            deletePageMutation.mutate(page.id)
        }
    }

    const duplicatePageMutation = useMutation({
        mutationFn: async (page) => {
            const duplicateData = {
                title: `${page.title} (Copy)`,
                slug: `${page.slug}-copy-${Date.now()}`,
                publicationStatus: 'unpublished', // Always create duplicates as unpublished
                layout: page.layout?.id || null,
                theme: page.theme?.id || null,
                parent: page.parent?.id || null
            }
            const response = await api.post('/api/v1/webpages/pages/', duplicateData)
            return response.data
        },
        onSuccess: (newPage) => {
            addNotification(`Page duplicated successfully as "${newPage.title}"`, 'success', 'page-duplicate')
            queryClient.invalidateQueries(['pages'])
            setSelectedPage(newPage)
        },
        onError: (error) => {
            addNotification('Failed to duplicate page', 'error', 'page-duplicate')
        }
    })

    const handleDuplicatePage = (page) => {
        duplicatePageMutation.mutate(page)
    }

    // Handle editing page with fullscreen editor
    const handleEditPage = (page) => {
        navigate(`/pages/${page.id}/edit/content`, {
            state: { previousView: '/settings' }
        })
    }





    const renderVersionManagement = () => {
        if (!selectedPage) {
            return (
                <div className="bg-white rounded-lg shadow p-8">
                    <div className="text-center text-gray-500">
                        <History className="w-8 h-8 mx-auto mb-2" />
                        <p>Select a page from the Pages tab to view its version history</p>
                    </div>
                </div>
            )
        }

        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold">Version History</h3>
                        <p className="text-sm text-gray-600">
                            Managing versions for: <span className="font-medium">{selectedPage.title}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => setShowVersionManager(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Open Version Manager
                    </button>
                </div>

                <div className="text-center text-gray-500 py-8">
                    <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Click "Open Version Manager" to view and manage page versions</p>
                </div>
            </div>
        )
    }



    const renderPublishingWorkflow = () => {
        const publishingTabs = [
            {
                id: 'dashboard',
                label: 'Status Dashboard',
                icon: Eye,
                component: PublicationStatusDashboard
            },
            {
                id: 'timeline',
                label: 'Publication Timeline',
                icon: Calendar,
                component: PublicationTimeline
            },
            {
                id: 'bulk',
                label: 'Bulk Operations',
                icon: Clock,
                component: BulkPublishingOperations
            }
        ]

        const ActiveComponent = publishingTabs.find(tab => tab.id === publishingView)?.component

        return (
            <div className="space-y-6">
                {/* Publishing Workflow Sub-tabs */}
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                    <nav className="flex space-x-6">
                        {publishingTabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = publishingView === tab.id

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        const newSearchParams = new URLSearchParams(searchParams)
                                        newSearchParams.set('publishingView', tab.id)
                                        setSearchParams(newSearchParams)
                                    }}
                                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </nav>
                </div>

                {/* Publishing Workflow Content */}
                <div className="p-6">
                    {ActiveComponent && <ActiveComponent />}
                </div>
            </div>
        )
    }

    const renderNamespaceManagement = () => {
        return (
            <NamespaceManager />
        )
    }

    const handleThemeSave = async () => {
        if (themeSaveHandler) {
            await themeSaveHandler()
        }
    }

    const handleThemeEditorCallback = useCallback((saveHandler) => {
        setThemeSaveHandler(() => saveHandler);
    }, []);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'layouts':
                return <LayoutEditor />
            case 'themes':
                return <ThemeEditor onSave={handleThemeEditorCallback} />
            case 'widgets':
                return <WidgetManager />
            case 'value-lists':
                return <ValueListEditor />
            case 'object-types':
                return <ObjectTypeManager />

            case 'versions':
                return renderVersionManagement()

            case 'publishing':
                return renderPublishingWorkflow()
            case 'namespaces':
                return renderNamespaceManagement()
            default:
                return null
        }
    }

    // Note: Schema management is handled by dedicated routes /schemas/*

    return (
        <div className="space-y-6">
            {/* Navigation Dropdown */}
            <SettingsTabs />

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow">
                <div>
                    {renderTabContent()}
                </div>
            </div>

            {/* Version Manager Modal */}
            {showVersionManager && selectedPage && (
                <VersionManager
                    pageId={selectedPage.id}
                    onClose={() => setShowVersionManager(false)}
                />
            )}

            {/* StatusBar for theme editing */}
            {activeTab === 'themes' && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <StatusBar
                        isDirty={isThemeDirty}
                        onSaveClick={handleThemeSave}
                        isSaving={false}
                        customStatusContent={
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">
                                    Editing theme
                                </span>
                            </div>
                        }
                    />
                </div>
            )}
        </div>
    )
}

// Add the PageForm component at the end of the file, before the export
const PageForm = ({ page = null, onSave, onCancel, isLoading = false }) => {
    const [formData, setFormData] = useState({
        title: page?.title || '',
        slug: page?.slug || '',
        publicationStatus: page?.publicationStatus || 'unpublished'
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            addNotification('Page title is required', 'error', 'form-validation')
            return
        }
        if (!formData.slug.trim()) {
            addNotification('Page slug is required', 'error', 'form-validation')
            return
        }
        onSave(formData)
    }

    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleTitleChange = (e) => {
        const title = e.target.value
        setFormData(prev => ({
            ...prev,
            title,
            // Auto-generate slug if it's empty or matches the previous auto-generated slug
            slug: !page && (!prev.slug || prev.slug === generateSlug(prev.title))
                ? generateSlug(title)
                : prev.slug
        }))
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                    {page ? 'Edit Page' : 'Create New Page'}
                </h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="page-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Page Title *
                        </label>
                        <input
                            id="page-title"
                            type="text"
                            value={formData.title}
                            onChange={handleTitleChange}
                            placeholder="Enter page title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="page-slug" className="block text-sm font-medium text-gray-700 mb-1">
                            URL Slug *
                        </label>
                        <input
                            id="page-slug"
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="page-url-slug"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="publication-status" className="block text-sm font-medium text-gray-700 mb-1">
                        Publication Status
                    </label>
                    <select
                        id="publication-status"
                        value={formData.publicationStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, publicationStatus: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="unpublished">Unpublished</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>

                <div className="flex items-center justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isLoading ? 'Saving...' : (page ? 'Update Page' : 'Create Page')}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default SettingsManager 