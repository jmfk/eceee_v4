import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Save,
    X,
    Eye,
    Settings,
    Layout,
    FileText,
    Clock,
    Share2,
    MoreHorizontal,
    ChevronDown,
    ArrowLeft,
    Grid3X3,
    Palette,
    ChevronLeft,
    ChevronRight,
    Trash2
} from 'lucide-react'
import { api } from '../api/client.js'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import SlotManager from './SlotManager'
import LayoutSelector from './LayoutSelector'
import StatusBar from './StatusBar'
import { layoutsApi } from '../api/layouts'

const PageEditor = () => {
    const { pageId, tab } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    // Determine previous view from location state or default to /pages
    const previousView = location.state?.previousView || '/pages'
    const isNewPage = pageId === 'new' || !pageId
    const activeTab = tab || 'content'

    // Redirect to content tab if no tab is specified
    useEffect(() => {
        if (!tab) {
            const defaultPath = isNewPage ? `/pages/new/content` : `/pages/${pageId}/edit/content`
            navigate(defaultPath, { replace: true, state: { previousView } })
        }
    }, [tab, isNewPage, pageId, navigate, previousView])
    const [pageData, setPageData] = useState(null)
    const [isDirty, setIsDirty] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)

    const queryClient = useQueryClient()
    const { showError, showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Initialize page data for new page
    useEffect(() => {
        if (isNewPage && !pageData) {
            setPageData({
                title: '',
                slug: '',
                description: '',
                publication_status: 'unpublished',
                code_layout: '',
                meta_title: '',
                meta_description: '',
                hostnames: []
            })
        }
    }, [isNewPage, pageData])

    // Fetch page data (skip if creating new page)
    const { data: page, isLoading } = useQuery({
        queryKey: ['page', pageId],
        queryFn: async () => {
            const response = await api.get(`/api/v1/webpages/pages/${pageId}/`)
            return response.data
        },
        enabled: !isNewPage
    })

    // Set page data when loaded
    useEffect(() => {
        if (page && !isNewPage) {
            setPageData(page)
        }
    }, [page, isNewPage])

    // Create page mutation (for new pages)
    const createPageMutation = useMutation({
        mutationFn: async (pageData) => {
            const response = await api.post('/api/v1/webpages/pages/', pageData)
            return response.data
        },
        onSuccess: (newPage) => {
            addNotification('Page created successfully', 'success', 'page-create')
            setIsDirty(false)
            // Navigate to edit the newly created page
            navigate(`/pages/${newPage.id}/edit`, {
                replace: true,
                state: { previousView }
            })
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            addNotification('Failed to create page', 'error', 'page-create')
            showError(error, 'Failed to create page')
        }
    })

    // Update page mutation
    const updatePageMutation = useMutation({
        mutationFn: async (pageData) => {
            // Only send the fields that should be updated
            const updateFields = {
                title: pageData.title,
                slug: pageData.slug,
                description: pageData.description,
                code_layout: pageData.code_layout,
                publication_status: pageData.publication_status,
                meta_title: pageData.meta_title,
                meta_description: pageData.meta_description,
                hostnames: pageData.hostnames
            }

            const response = await api.patch(`/api/v1/webpages/pages/${pageId}/`, updateFields)
            return response.data
        },
        onSuccess: (updatedPage) => {
            addNotification('Page saved successfully', 'success', 'page-save')
            setPageData(updatedPage)
            setIsDirty(false)
            queryClient.invalidateQueries(['page', pageId])
            queryClient.invalidateQueries(['pages', 'root'])
        },
        onError: (error) => {
            addNotification('Failed to save page', 'error', 'page-save')
            showError(error, 'Failed to save page')
        }
    })

    // Publish page mutation
    const publishPageMutation = useMutation({
        mutationFn: async () => {
            const response = await api.patch(`/api/v1/webpages/pages/${pageId}/`, {
                publication_status: 'published'
            })
            return response.data
        },
        onSuccess: (updatedPage) => {
            addNotification('Page published successfully', 'success', 'page-publish')
            setPageData(updatedPage)
            queryClient.invalidateQueries(['page', pageId])
            queryClient.invalidateQueries(['pages', 'root'])
        },
        onError: (error) => {
            addNotification('Failed to publish page', 'error', 'page-publish')
            showError(error, 'Failed to publish page')
        }
    })

    // Handle close with unsaved changes check
    const handleClose = async () => {
        if (isDirty) {
            const confirmed = await showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to close?',
                confirmText: 'Close without saving',
                confirmButtonStyle: 'danger'
            })
            if (!confirmed) return
        }
        navigate(previousView)
    }

    // Handle save
    const handleSave = () => {
        if (pageData && isDirty) {
            if (isNewPage) {
                addNotification('Creating page...', 'info', 'page-create')
                createPageMutation.mutate(pageData)
            } else {
                addNotification('Saving page...', 'info', 'page-save')
                updatePageMutation.mutate(pageData)
            }
        }
    }

    // Handle quick publish (only for existing pages)
    const handleQuickPublish = () => {
        if (isNewPage) return

        addNotification('Publishing page...', 'info', 'page-publish')
        setIsPublishing(true)
        publishPageMutation.mutate()
        setIsPublishing(false)
    }

    // Handle page data updates
    const updatePageData = (updates) => {
        setPageData(prev => ({ ...prev, ...updates }))
        setIsDirty(true)
    }

    // Tab navigation
    const tabs = [
        { id: 'content', label: 'Content', icon: Layout },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'metadata', label: 'Metadata', icon: FileText },
        { id: 'preview', label: 'Preview', icon: Eye },
    ]

    if (isLoading && !isNewPage) {
        return (
            <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading page editor...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
            {/* Top Menu Bar */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left section - Back button and page info */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleClose}
                                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to {previousView === '/pages' ? 'Pages' :
                                    previousView === '/settings' ? 'Settings' : 'Previous View'}
                            </button>

                            <div className="h-6 w-px bg-gray-300"></div>

                            <div>
                                <h1 className="text-lg font-semibold text-gray-900 truncate">
                                    {isNewPage ? 'New Page' : (pageData?.title || 'Untitled Page')}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    /{isNewPage ? 'new-page-slug' : (pageData?.slug || 'page-slug')}
                                </p>
                            </div>
                        </div>

                        {/* Center section - Tab navigation */}
                        <div className="flex items-center space-x-1">
                            {tabs.map((tabItem) => {
                                const Icon = tabItem.icon
                                const tabPath = isNewPage ? `/pages/new/${tabItem.id}` : `/pages/${pageId}/edit/${tabItem.id}`
                                const isActive = activeTab === tabItem.id

                                return (
                                    <button
                                        key={tabItem.id}
                                        onClick={() => navigate(tabPath, { state: { previousView } })}
                                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {tabItem.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Right section - Actions */}
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleSave}
                                disabled={!isDirty || updatePageMutation.isPending || createPageMutation.isPending}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {updatePageMutation.isPending || createPageMutation.isPending ? 'Saving...' :
                                    isNewPage ? 'Create Page' : 'Save'}
                            </button>

                            <button
                                onClick={handleQuickPublish}
                                disabled={pageData?.publication_status === 'published' || isPublishing}
                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                {isPublishing ? 'Publishing...' : 'Publish'}
                            </button>

                            <div className="relative">
                                <button className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full">
                    {activeTab === 'content' && (
                        <ContentEditor
                            pageData={pageData}
                            onUpdate={updatePageData}
                            isNewPage={isNewPage}
                        />
                    )}
                    {activeTab === 'settings' && (
                        <SettingsEditor
                            pageData={pageData}
                            onUpdate={updatePageData}
                            isNewPage={isNewPage}
                        />
                    )}
                    {activeTab === 'metadata' && (
                        <MetadataEditor
                            pageData={pageData}
                            onUpdate={updatePageData}
                            isNewPage={isNewPage}
                        />
                    )}
                    {activeTab === 'preview' && (
                        <div className="h-full bg-white">
                            <PagePreview pageData={pageData} />
                        </div>
                    )}
                </div>
            </div>

            {/* Status bar with notifications */}
            <StatusBar
                showAutoSave={true}
                isDirty={isDirty}
                customStatusContent={
                    <div className="flex items-center space-x-4">
                        <span>
                            Status: <span className={`font-medium ${pageData?.publication_status === 'published' ? 'text-green-600' :
                                pageData?.publication_status === 'scheduled' ? 'text-blue-600' :
                                    'text-gray-600'
                                }`}>
                                {pageData?.publication_status || 'unpublished'}
                            </span>
                        </span>
                        {pageData?.last_modified && (
                            <span>
                                Last modified: {new Date(pageData.last_modified).toLocaleString()}
                            </span>
                        )}
                    </div>
                }
            />
        </div>
    )
}

// Content Editor Tab
const ContentEditor = ({ pageData, onUpdate, isNewPage }) => {
    return (
        <div className="h-full flex">
            {/* Main content area */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white rounded-lg shadow p-6">

                        {/* Widget Management */}
                        {pageData?.id && !isNewPage && (
                            <SlotManager
                                pageId={pageData.id}
                                layout={pageData.code_layout}
                                onWidgetChange={() => {
                                    // Trigger a refresh of page data if needed
                                }}
                            />
                        )}

                        {/* Message for new pages */}
                        {isNewPage && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                <p className="text-blue-700">
                                    Save the page first to enable widget management and layout configuration.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Settings Editor Tab
const SettingsEditor = ({ pageData, onUpdate, isNewPage }) => {
    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Page Settings</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Page Title
                            </label>
                            <input
                                type="text"
                                value={pageData?.title || ''}
                                onChange={(e) => onUpdate({ title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter page title"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URL Slug
                            </label>
                            <input
                                type="text"
                                value={pageData?.slug || ''}
                                onChange={(e) => onUpdate({ slug: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="page-url-slug"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={pageData?.description || ''}
                                onChange={(e) => onUpdate({ description: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter page description"
                            />
                        </div>

                        {/* Page Layout Selection */}
                        <div>
                            <LayoutSelector
                                value={pageData?.code_layout || ''}
                                onChange={(layout) => onUpdate({ code_layout: layout })}
                                label="Page Layout"
                                description="Choose the layout template for this page"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Publication Status
                            </label>
                            <select
                                value={pageData?.publication_status || 'unpublished'}
                                onChange={(e) => onUpdate({ publication_status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="unpublished">Unpublished</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="published">Published</option>
                                <option value="expired">Expired</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Metadata Editor Tab
const MetadataEditor = ({ pageData, onUpdate, isNewPage }) => {
    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">SEO & Metadata</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Title
                            </label>
                            <input
                                type="text"
                                value={pageData?.meta_title || pageData?.title || ''}
                                onChange={(e) => onUpdate({ meta_title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO title for search engines"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Description
                            </label>
                            <textarea
                                value={pageData?.meta_description || pageData?.description || ''}
                                onChange={(e) => onUpdate({ meta_description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO description for search engines"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hostnames
                            </label>
                            <input
                                type="text"
                                value={pageData?.hostnames?.join(', ') || ''}
                                onChange={(e) => onUpdate({
                                    hostnames: e.target.value.split(',').map(h => h.trim()).filter(h => h)
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="example.com, www.example.com"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Enter hostnames separated by commas
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Simple preview component
const PagePreview = ({ pageData }) => {
    return (
        <div className="h-full p-6 overflow-y-auto bg-gray-100">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow">
                <div className="p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {pageData?.title || 'Untitled Page'}
                    </h1>
                    {pageData?.description && (
                        <p className="text-lg text-gray-600 mb-6">
                            {pageData.description}
                        </p>
                    )}
                    <div className="prose max-w-none">
                        <p className="text-gray-500 italic">
                            Live preview of page content would appear here...
                        </p>
                        <p className="text-sm text-gray-400 mt-4">
                            Current layout: {pageData?.code_layout || 'None selected'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PageEditor 