import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    FileText,
    Layers,
    Palette,
    Settings,
    Grid3X3,
    Eye,
    Plus,
    Search
} from 'lucide-react'
import axios from 'axios'
import LayoutEditor from '../components/LayoutEditor'
import ThemeEditor from '../components/ThemeEditor'
import SlotManager from '../components/SlotManager'

const PageManagement = () => {
    const [activeTab, setActiveTab] = useState('pages')
    const [selectedPage, setSelectedPage] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Fetch pages
    const { data: pages, isLoading: pagesLoading } = useQuery({
        queryKey: ['pages'],
        queryFn: async () => {
            const response = await axios.get('/api/webpages/api/pages/')
            return response.data
        }
    })

    // Filter pages based on search
    const filteredPages = pages?.filter(page =>
        page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.slug.toLowerCase().includes(searchTerm.toLowerCase())
    ) || []

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
        }
    ]

    const renderPageManagement = () => (
        <div className="space-y-6">
            {/* Page List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Pages</h3>
                        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
                                                // Handle page preview
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
                                                setActiveTab('widgets')
                                            }}
                                            className="p-1 text-blue-600 hover:text-blue-700"
                                            title="Manage widgets"
                                        >
                                            <Layers className="w-4 h-4" />
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

            {/* Selected Page Details */}
            {selectedPage && (
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
        </div>
    )
}

export default PageManagement 