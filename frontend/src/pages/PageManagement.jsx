import { useState, useEffect } from 'react'
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
    X
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import LayoutEditor from '../components/LayoutEditor'
import ThemeEditor from '../components/ThemeEditor'
import SlotManager from '../components/SlotManager'
import VersionManager from '../components/VersionManager'
import ObjectPublisher from '../components/ObjectPublisher'
import PublicationStatusDashboard from '../components/PublicationStatusDashboard'
import PublicationTimeline from '../components/PublicationTimeline'
import BulkPublishingOperations from '../components/BulkPublishingOperations'

const PageManagement = () => {
    const [activeTab, setActiveTab] = useState('pages')
    const [selectedPage, setSelectedPage] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showVersionManager, setShowVersionManager] = useState(false)
    const [publishingView, setPublishingView] = useState('dashboard') // 'dashboard', 'timeline', 'bulk'
    const [isCreating, setIsCreating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const queryClient = useQueryClient()

    // Fetch pages
    const { data: pagesResponse, isLoading: pagesLoading } = useQuery({
        queryKey: ['pages'],
        queryFn: async () => {
            const response = await axios.get('/api/v1/webpages/pages/')
            return response.data
        }
    })

    // Extract pages array from paginated response
    const pages = pagesResponse?.results || []

    // Filter pages based on search
    const filteredPages = pages.filter(page =>
        page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const tabs = [
        {
            id: 'pages',
            label: 'Pages',
            icon: FileText,
            description: 'Manage pages and content'
        },
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
            id: 'objects',
            label: 'Object Publishing',
            icon: Link,
            description: 'Link objects to pages for publishing'
        },
        {
            id: 'publishing',
            label: 'Publishing Workflow',
            icon: Calendar,
            description: 'Manage publication scheduling and status'
        }
    ]

    // Add these mutations for creating and updating pages
    const createPageMutation = useMutation({
        mutationFn: async (pageData) => {
            const response = await axios.post('/api/v1/webpages/pages/', pageData)
            return response.data
        },
        onSuccess: () => {
            toast.success('Page created successfully')
            setIsCreating(false)
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Failed to create page')
        }
    })

    const updatePageMutation = useMutation({
        mutationFn: async ({ id, ...pageData }) => {
            const response = await axios.patch(`/api/v1/webpages/pages/${id}/`, pageData)
            return response.data
        },
        onSuccess: () => {
            toast.success('Page updated successfully')
            setIsEditing(false)
            setSelectedPage(null)
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Failed to update page')
        }
    })

    const renderPageManagement = () => (
        <div className="space-y-6">
            {/* Page List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Pages</h3>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Page
                        </button>
                    </div>
                    <div className="mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search pages..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {pagesLoading ? (
                        <div className="p-8 text-center text-gray-500">
                            <div className="animate-pulse space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                                ))}
                            </div>
                        </div>
                    ) : filteredPages.length > 0 ? (
                        filteredPages.map((page) => (
                            <div
                                key={page.id}
                                onClick={() => setSelectedPage(page)}
                                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedPage?.id === page.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium text-gray-900">{page.title}</h4>
                                        <p className="text-sm text-gray-500 mt-1">/{page.slug}</p>
                                        <div className="flex items-center space-x-4 mt-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${page.publication_status === 'published'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {page.publication_status}
                                            </span>
                                            {page.layout && (
                                                <span className="text-xs text-gray-500">
                                                    Layout: {page.layout.name}
                                                </span>
                                            )}
                                            {page.theme && (
                                                <span className="text-xs text-gray-500">
                                                    Theme: {page.theme.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                // Handle page preview - could navigate to preview URL
                                                window.open(`/pages/${page.slug}`, '_blank')
                                            }}
                                            className="p-1 text-gray-400 hover:text-gray-600"
                                            title="Preview page"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedPage(page)
                                                setIsEditing(true)
                                            }}
                                            className="p-1 text-green-600 hover:text-green-700"
                                            title="Edit page"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedPage(page)
                                                setActiveTab('widgets')
                                            }}
                                            className="p-1 text-blue-600 hover:text-blue-700"
                                            title="Manage widgets"
                                        >
                                            <Layers className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedPage(page)
                                                setShowVersionManager(true)
                                            }}
                                            className="p-1 text-purple-600 hover:text-purple-700"
                                            title="Version history"
                                        >
                                            <History className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            <FileText className="w-8 h-8 mx-auto mb-2" />
                            <p>No pages found</p>
                            {searchTerm && (
                                <p className="text-sm mt-1">
                                    Try adjusting your search terms
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Page Create/Edit Form */}
            {(isCreating || isEditing) && (
                <PageForm
                    page={isEditing ? selectedPage : null}
                    onSave={(pageData) => {
                        if (isEditing) {
                            updatePageMutation.mutate({ id: selectedPage.id, ...pageData })
                        } else {
                            createPageMutation.mutate(pageData)
                        }
                    }}
                    onCancel={() => {
                        setIsCreating(false)
                        setIsEditing(false)
                        setSelectedPage(null)
                    }}
                    isLoading={createPageMutation.isLoading || updatePageMutation.isLoading}
                />
            )}

            {/* Selected Page Details - only show when not creating/editing */}
            {selectedPage && !isCreating && !isEditing && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Page Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Page Title
                            </label>
                            <p className="text-sm text-gray-900">{selectedPage.title}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                URL Slug
                            </label>
                            <p className="text-sm text-gray-900">/{selectedPage.slug}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Layout
                            </label>
                            <p className="text-sm text-gray-900">
                                {selectedPage.layout?.name || 'No layout assigned'}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Theme
                            </label>
                            <p className="text-sm text-gray-900">
                                {selectedPage.theme?.name || 'No theme assigned'}
                            </p>
                        </div>
                    </div>
                    {selectedPage.description && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <p className="text-sm text-gray-900">{selectedPage.description}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )

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

    const renderObjectPublishing = () => {
        if (!selectedPage) {
            return (
                <div className="p-6">
                    <div className="text-center text-gray-500 py-12">
                        <Link className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Page Selected</h3>
                        <p>Select a page from the Pages tab to manage object publishing</p>
                    </div>
                </div>
            )
        }

        return (
            <div className="p-6">
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Object Publishing for: {selectedPage.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                        Link content objects to this page for dynamic publishing
                    </p>
                </div>

                <ObjectPublisher
                    pageId={selectedPage.id}
                    onObjectLinked={(object, objectType) => {
                        // Refresh page data or show success message
                        console.log('Object linked:', object, objectType)
                    }}
                    onObjectUnlinked={() => {
                        // Refresh page data or show success message
                        console.log('Object unlinked')
                    }}
                />
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

    const renderTabContent = () => {
        switch (activeTab) {
            case 'pages':
                return renderPageManagement()
            case 'layouts':
                return <LayoutEditor />
            case 'themes':
                return <ThemeEditor />
            case 'widgets':
                return renderWidgetManagement()
            case 'versions':
                return renderVersionManagement()
            case 'objects':
                return renderObjectPublishing()
            case 'publishing':
                return renderPublishingWorkflow()
            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6">
                <h1 className="text-2xl font-bold text-gray-900">Page Management</h1>
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
        description: page?.description || '',
        publication_status: page?.publication_status || 'draft'
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            toast.error('Page title is required')
            return
        }
        if (!formData.slug.trim()) {
            toast.error('Page slug is required')
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
                    <label htmlFor="page-description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                    </label>
                    <textarea
                        id="page-description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter page description"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
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

export default PageManagement 