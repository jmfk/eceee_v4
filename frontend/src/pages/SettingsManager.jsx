import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import LayoutEditor from '../components/LayoutEditor'
import ThemeEditor from '../components/ThemeEditor'
import SlotManager from '../components/SlotManager'
import VersionManager from '../components/VersionManager'

import PublicationStatusDashboard from '../components/PublicationStatusDashboard'
import PublicationTimeline from '../components/PublicationTimeline'
import BulkPublishingOperations from '../components/BulkPublishingOperations'
import NamespaceManager from '../components/NamespaceManager'
import { extractErrorMessage } from '../utils/errorHandling.js'

const SettingsManager = () => {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('layouts')
    const [selectedPage, setSelectedPage] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showVersionManager, setShowVersionManager] = useState(false)
    const [publishingView, setPublishingView] = useState('dashboard') // 'dashboard', 'timeline', 'bulk'
    const [isCreating, setIsCreating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [layoutFilter, setLayoutFilter] = useState('all')
    const [showFilters, setShowFilters] = useState(false)
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

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
        const matchesSearch = page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            page.slug.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = statusFilter === 'all' || page.publication_status === statusFilter

        const matchesLayout = layoutFilter === 'all' ||
            (layoutFilter === 'none' && !page.code_layout) ||
            (layoutFilter.startsWith('code:') && page.code_layout === layoutFilter.split(':')[1])

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
            if (allLayouts.code_layouts) {
                allLayouts.code_layouts.forEach(layout => {
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

    const tabs = [
        {
            id: 'layouts',
            label: 'Layouts',
            icon: Grid3X3,
            description: 'Design page layouts and slots'
        },
        {
            id: 'themes',
            label: 'Themes',
            icon: Palette,
            description: 'Customize colors and styling'
        },
        {
            id: 'widgets',
            label: 'Widgets',
            icon: Layers,
            description: 'Manage page widgets and content'
        },
        {
            id: 'versions',
            label: 'Versions',
            icon: Settings,
            description: 'Page version control and history'
        },

        {
            id: 'publishing',
            label: 'Publishing Workflow',
            icon: Calendar,
            description: 'Manage publication scheduling and status'
        },
        {
            id: 'namespaces',
            label: 'Namespaces',
            icon: FolderOpen,
            description: 'Manage website namespaces'
        }
    ]

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
                publication_status: 'unpublished', // Always create duplicates as unpublished
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



    const renderWidgetManagement = () => {
        if (!selectedPage) {
            return (
                <div className="bg-white rounded-lg shadow p-8">
                    <div className="text-center text-gray-500">
                        <Layers className="w-8 h-8 mx-auto mb-2" />
                        <p>Select a page from the Pages tab to manage its widgets</p>
                    </div>
                </div>
            )
        }

        if (!selectedPage.layout) {
            return (
                <div className="bg-white rounded-lg shadow p-8">
                    <div className="text-center text-gray-500">
                        <Grid3X3 className="w-8 h-8 mx-auto mb-2" />
                        <p>This page has no layout assigned</p>
                        <p className="text-sm mt-1">
                            Assign a layout to this page before managing widgets
                        </p>
                    </div>
                </div>
            )
        }

        return (
            <SlotManager
                pageId={selectedPage.id}
                layout={selectedPage.layout}
                onWidgetChange={() => {
                    // Refresh page data when widgets change
                    // This will be handled by React Query cache invalidation
                }}
            />
        )
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
                                    onClick={() => setPublishingView(tab.id)}
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

    const renderTabContent = () => {
        switch (activeTab) {
            case 'layouts':
                return <LayoutEditor />
            case 'themes':
                return <ThemeEditor />
            case 'widgets':
                return renderWidgetManagement()
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6">
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-2">
                    Manage your website pages, layouts, themes, and widgets
                </p>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${isActive
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className={`mr-2 w-5 h-5 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                                        }`} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </nav>

                    {/* Tab Description */}
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                        <p className="text-sm text-gray-600">
                            {tabs.find(tab => tab.id === activeTab)?.description}
                        </p>
                    </div>

                </div>

                {/* Tab Content */}
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
        </div>
    )
}

// Add the PageForm component at the end of the file, before the export
const PageForm = ({ page = null, onSave, onCancel, isLoading = false }) => {
    const [formData, setFormData] = useState({
        title: page?.title || '',
        slug: page?.slug || '',
        publication_status: page?.publication_status || 'unpublished'
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
                        value={formData.publication_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, publication_status: e.target.value }))}
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