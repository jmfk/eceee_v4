import { useState } from 'react'
import {
    Settings,
    Layout,
    Palette,
    Eye,
    TreePine,
    FileText,
    Grid3X3
} from 'lucide-react'
import LayoutEditor from '@components/LayoutEditor'
import ThemeEditor from '@components/ThemeEditor'
import PagePreview from '@components/PagePreview'

const PageManagement = () => {
    const [activeTab, setActiveTab] = useState('layouts')
    const [previewPageId, setPreviewPageId] = useState(null)
    const [previewLayoutId, setPreviewLayoutId] = useState(null)
    const [previewThemeId, setPreviewThemeId] = useState(null)

    const tabs = [
        {
            id: 'layouts',
            label: 'Layouts',
            icon: Grid3X3,
            description: 'Create and manage page layout templates'
        },
        {
            id: 'themes',
            label: 'Themes',
            icon: Palette,
            description: 'Design color schemes and styling'
        },
        {
            id: 'preview',
            label: 'Preview',
            icon: Eye,
            description: 'Preview layout and theme combinations'
        },
        {
            id: 'inheritance',
            label: 'Inheritance',
            icon: TreePine,
            description: 'Manage inheritance hierarchy'
        }
    ]

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'layouts':
                return <LayoutEditor />
            case 'themes':
                return <ThemeEditor />
            case 'preview':
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Layout & Theme Preview</h2>
                            <p className="text-gray-600 mb-6">
                                Test how different layout and theme combinations will look together.
                            </p>

                            {/* Preview Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Sample Page
                                    </label>
                                    <select
                                        value={previewPageId || ''}
                                        onChange={(e) => setPreviewPageId(e.target.value || null)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select a page to preview...</option>
                                        <option value="1">Home Page</option>
                                        <option value="2">About Us</option>
                                        <option value="3">Services</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Layout Override
                                    </label>
                                    <select
                                        value={previewLayoutId || ''}
                                        onChange={(e) => setPreviewLayoutId(e.target.value || null)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Use inherited layout</option>
                                        <option value="1">Two Column Layout</option>
                                        <option value="2">Three Column Layout</option>
                                        <option value="3">Single Column Layout</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Theme Override
                                    </label>
                                    <select
                                        value={previewThemeId || ''}
                                        onChange={(e) => setPreviewThemeId(e.target.value || null)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Use inherited theme</option>
                                        <option value="1">Blue Theme</option>
                                        <option value="2">Dark Theme</option>
                                        <option value="3">Green Theme</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Preview Component */}
                        <PagePreview
                            pageId={previewPageId}
                            layoutId={previewLayoutId}
                            themeId={previewThemeId}
                            className="min-h-[600px]"
                        />
                    </div>
                )
            case 'inheritance':
                return <InheritanceManager />
            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <Settings className="w-8 h-8 text-blue-600 mr-3" />
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    Page Management System
                                </h1>
                                <p className="text-sm text-gray-500">
                                    Phase 3: Layout and Theme System
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className="w-5 h-5 mr-2" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Tab Description */}
            <div className="bg-blue-50 border-b border-blue-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <p className="text-blue-800 text-sm">
                        {tabs.find(tab => tab.id === activeTab)?.description}
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderActiveTab()}
            </main>
        </div>
    )
}

// Inheritance Manager Component
const InheritanceManager = () => {
    const [selectedPageId, setSelectedPageId] = useState(null)

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Inheritance Management</h2>
                <p className="text-gray-600 mb-6">
                    Visualize and manage how layouts, themes, and widgets inherit through the page hierarchy.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Page Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Page to Analyze
                        </label>
                        <select
                            value={selectedPageId || ''}
                            onChange={(e) => setSelectedPageId(e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Choose a page...</option>
                            <option value="1">Home Page</option>
                            <option value="2">About Us</option>
                            <option value="3">Services</option>
                            <option value="4">Services → Web Development</option>
                            <option value="5">Services → Web Development → React</option>
                        </select>
                    </div>

                    {/* Quick Actions */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quick Actions
                        </label>
                        <div className="flex space-x-2">
                            <button
                                disabled={!selectedPageId}
                                className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                View Inheritance
                            </button>
                            <button
                                disabled={!selectedPageId}
                                className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                                Override Layout
                            </button>
                            <button
                                disabled={!selectedPageId}
                                className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                            >
                                Override Theme
                            </button>
                        </div>
                    </div>
                </div>

                {selectedPageId && (
                    <div className="mt-8">
                        <InheritanceVisualization pageId={selectedPageId} />
                    </div>
                )}
            </div>
        </div>
    )
}

// Inheritance Visualization Component
const InheritanceVisualization = ({ pageId }) => {
    // Mock data - in real implementation, this would come from the API
    const inheritanceData = {
        inheritance_chain: [
            { id: 1, title: 'Root', level: 0 },
            { id: 2, title: 'Services', level: 1 },
            { id: 3, title: 'Web Development', level: 2 },
            { id: 4, title: 'React Development', level: 3 }
        ],
        layout_info: {
            effective_layout: { name: 'Two Column Layout' },
            inherited_from: { id: 2, title: 'Services' }
        },
        theme_info: {
            effective_theme: { name: 'Blue Theme' },
            inherited_from: { id: 1, title: 'Root' }
        },
        conflicts: []
    }

    return (
        <div className="space-y-6">
            {/* Inheritance Chain */}
            <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Inheritance Chain</h3>
                <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                    {inheritanceData.inheritance_chain.map((page, index) => (
                        <div key={page.id} className="flex items-center">
                            <div className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${index === inheritanceData.inheritance_chain.length - 1
                                ? 'bg-blue-100 text-blue-800 font-medium'
                                : 'bg-gray-100 text-gray-700'
                                }`}>
                                {page.title}
                            </div>
                            {index < inheritanceData.inheritance_chain.length - 1 && (
                                <div className="mx-2 text-gray-400">→</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Layout Inheritance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Layout Inheritance</h4>
                    <div className="text-sm text-gray-600">
                        <p>
                            <strong>Current Layout:</strong> {inheritanceData.layout_info.effective_layout?.name}
                        </p>
                        {inheritanceData.layout_info.inherited_from && (
                            <p className="mt-1">
                                <strong>Inherited from:</strong> {inheritanceData.layout_info.inherited_from.title}
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Theme Inheritance</h4>
                    <div className="text-sm text-gray-600">
                        <p>
                            <strong>Current Theme:</strong> {inheritanceData.theme_info.effective_theme?.name}
                        </p>
                        {inheritanceData.theme_info.inherited_from && (
                            <p className="mt-1">
                                <strong>Inherited from:</strong> {inheritanceData.theme_info.inherited_from.title}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Conflicts */}
            {inheritanceData.conflicts.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Inheritance Conflicts</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                        {inheritanceData.conflicts.map((conflict, index) => (
                            <li key={index}>• {conflict.message}</li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">✓ No Inheritance Conflicts</h4>
                    <p className="text-sm text-green-700">
                        All inheritance relationships are properly configured.
                    </p>
                </div>
            )}
        </div>
    )
}

export default PageManagement 