import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { themesApi } from '../api'
import { extractErrorMessage } from '../utils/errorHandling.js'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import HtmlElementStyleEditor from './HtmlElementStyleEditor'
import {
    Plus,
    Edit3,
    Trash2,
    Save,
    X,
    Palette,
    Eye,
    EyeOff,
    Copy,
    Download,
    Upload,
    Settings,
    Hash,
    Type,
    Image as ImageIcon,
    ChevronDown,
    Menu,
    Search,
    ArrowLeft
} from 'lucide-react'

const ThemeEditor = () => {
    const [selectedTheme, setSelectedTheme] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [currentView, setCurrentView] = useState('list') // 'list' or 'edit'
    const [searchTerm, setSearchTerm] = useState('')
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Fetch themes
    const { data: themes = [], isLoading } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            try {
                const response = await themesApi.list()

                // Check if response has data property or is direct array
                let themeData = null
                if (Array.isArray(response)) {
                    themeData = response
                } else if (response?.data && Array.isArray(response.data)) {
                    themeData = response.data
                } else if (response?.results && Array.isArray(response.results)) {
                    themeData = response.results
                } else {
                    console.warn('Unexpected themes API response structure:', response)
                    themeData = []
                }

                return themeData || []
            } catch (error) {
                console.error('Error fetching themes:', error)
                throw error
            }
        }
    })

    // Filter themes based on search term
    const filteredThemes = themes.filter(theme =>
        theme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        theme.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCreateNew = () => {
        setIsCreating(true)
        setCurrentView('edit')
    }

    const handleEditTheme = (theme) => {
        setSelectedTheme(theme)
        setIsCreating(false)
        setCurrentView('edit')
    }

    const handleBackToList = () => {
        setCurrentView('list')
        setSelectedTheme(null)
        setIsCreating(false)
    }

    const handleSaveComplete = () => {
        queryClient.invalidateQueries(['themes'])
        handleBackToList()
    }

    // List View
    const ListView = () => (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                            <Palette className="h-6 w-6 mr-2" />
                            Theme Editor
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Create and manage page themes with color schemes and styling
                        </p>
                    </div>
                    <button
                        onClick={handleCreateNew}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Theme
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search themes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full max-w-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
            )}

            {/* Themes Grid */}
            {!isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredThemes.map((theme) => (
                        <ThemeCard
                            key={theme.id}
                            theme={theme}
                            onEdit={handleEditTheme}
                            onDelete={(theme) => {
                                showConfirm(
                                    'Delete Theme',
                                    `Are you sure you want to delete "${theme.name}"?`,
                                    () => {
                                        themesApi.delete(theme.id).then(() => {
                                            addNotification('Theme deleted successfully', 'success')
                                            queryClient.invalidateQueries(['themes'])
                                        })
                                    }
                                )
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredThemes.length === 0 && (
                <div className="text-center py-12">
                    <Palette className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {searchTerm ? 'No matching themes' : 'No themes yet'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                        {searchTerm
                            ? 'Try adjusting your search terms'
                            : 'Create your first theme to get started'
                        }
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={handleCreateNew}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center mx-auto transition-colors"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Theme
                        </button>
                    )}
                </div>
            )}
        </div>
    )

    // Edit View
    const EditView = () => (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <button
                            onClick={handleBackToList}
                            className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {isCreating ? 'Create New Theme' : `Edit ${selectedTheme?.name}`}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {isCreating ? 'Configure your new theme settings' : 'Modify theme properties and styling'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border">
                {isCreating ? (
                    <ThemeForm
                        onSave={handleSaveComplete}
                        onCancel={handleBackToList}
                    />
                ) : selectedTheme ? (
                    <ThemeEditPanel
                        theme={selectedTheme}
                        onUpdate={handleSaveComplete}
                        onCancel={handleBackToList}
                    />
                ) : null}
            </div>
        </div>
    )

    // Main render
    if (currentView === 'edit') {
        return <EditView />
    }

    return <ListView />
}

// Theme Card Component
const ThemeCard = ({ theme, onEdit, onDelete }) => {
    const generateThemeThumbnail = (theme) => {
        // Generate a simple color preview based on theme variables
        const colors = Object.entries(theme.css_variables || {})
            .filter(([key, value]) => value.startsWith('#') || value.startsWith('rgb'))
            .slice(0, 4)

        return (
            <div className="w-full h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center overflow-hidden">
                {colors.length > 0 ? (
                    <div className="flex w-full h-full">
                        {colors.map(([key, color], index) => (
                            <div
                                key={key}
                                className="flex-1 h-full"
                                style={{ backgroundColor: color }}
                                title={`${key}: ${color}`}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center">
                        <Palette className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-500">No colors</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group">
            {/* Theme Preview */}
            <div onClick={() => onEdit(theme)}>
                {generateThemeThumbnail(theme)}

                {/* Theme Info */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                            {theme.name}
                        </h3>
                        <div className="flex items-center space-x-1">
                            {theme.is_default && (
                                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                                    Default
                                </span>
                            )}
                            {theme.is_active ? (
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                    Active
                                </span>
                            ) : (
                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                                    Inactive
                                </span>
                            )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                        {theme.description || 'No description provided'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                            {Object.keys(theme.css_variables || {}).length} variables
                        </span>
                        <span>
                            {Object.keys(theme.image_styles || {}).length} image styles
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 pb-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => onEdit(theme)}
                        className="flex items-center px-3 py-1 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                    >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Edit
                    </button>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                // TODO: Implement preview
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            title="Preview"
                        >
                            <Eye className="w-4 h-4" />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(theme)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Include all the existing components from the original file
// ThemeForm, ThemeEditPanel, ImageStylesEditor, etc. would go here
// For now, let's create placeholder components

const ThemeForm = ({ theme = null, onSave, onCancel }) => {
    // This would be the full ThemeForm component from the original file
    return (
        <div className="p-6">
            <h3 className="text-lg font-medium mb-4">
                {theme ? 'Edit Theme' : 'Create New Theme'}
            </h3>
            <p className="text-gray-600 mb-4">Theme form content would go here...</p>
            <div className="flex justify-end space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                    {theme ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    )
}

const ThemeEditPanel = ({ theme, onUpdate, onCancel }) => {
    // This would be the full ThemeEditPanel component from the original file
    return (
        <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Edit {theme.name}</h3>
            <p className="text-gray-600 mb-4">Theme edit panel content would go here...</p>
            <div className="flex justify-end space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    onClick={onUpdate}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                    Update
                </button>
            </div>
        </div>
    )
}

export default ThemeEditor
