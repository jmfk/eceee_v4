import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
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
    const [searchParams, setSearchParams] = useSearchParams()
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

    // Handle URL parameters for direct theme editing
    useEffect(() => {
        const editThemeId = searchParams.get('edit')
        if (editThemeId && themes.length > 0) {
            const themeToEdit = themes.find(theme => theme.id.toString() === editThemeId)
            if (themeToEdit) {
                setSelectedTheme(themeToEdit)
                setCurrentView('edit')
                setIsCreating(false)
            }
        }
    }, [searchParams, themes])

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
        // Clear URL parameters
        setSearchParams({})
    }

    const handleCreateComplete = (newTheme) => {
        queryClient.invalidateQueries(['themes'])

        // If we have the new theme data, navigate to it for editing
        if (newTheme) {
            setSelectedTheme(newTheme)
            setIsCreating(false)
            setCurrentView('edit')
            // Update URL to show the new theme being edited
            setSearchParams({ edit: newTheme.id.toString() })
            addNotification(`Now editing "${newTheme.name}"`, 'success', 'theme-navigation')
        } else {
            // Fallback to list view if no theme data provided
            handleBackToList()
        }
    }

    const handleUpdateComplete = (updatedTheme) => {
        queryClient.invalidateQueries(['themes'])
        // Update the selected theme with the latest data if provided
        if (updatedTheme) {
            setSelectedTheme(updatedTheme)
        }
        // Stay on edit view, don't navigate away
    }

    // List View
    const ListView = () => (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                        <span className="text-sm text-gray-500">{filteredThemes.length} themes</span>
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
                            onDelete={() => {
                                // Delete is now handled directly in ThemeCard component
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
                <div className="flex items-center mb-4">
                    <button
                        onClick={handleBackToList}
                        className="mr-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        title="Back to themes"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">
                            {isCreating ? 'Create Theme' : selectedTheme?.name}
                        </h1>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border">
                {isCreating ? (
                    <ThemeForm
                        onSave={handleCreateComplete}
                        onCancel={handleBackToList}
                    />
                ) : selectedTheme ? (
                    <ThemeEditPanel
                        theme={selectedTheme}
                        onUpdate={handleUpdateComplete}
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
    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()
    const [showPreview, setShowPreview] = useState(false)
    const [previewData, setPreviewData] = useState(null)

    // Delete mutation for better error handling
    const deleteMutation = useMutation({
        mutationFn: async () => {
            return await themesApi.delete(theme.id)
        },
        onSuccess: () => {
            addNotification('Theme deleted successfully', 'success')
            queryClient.invalidateQueries(['themes'])
        },
        onError: (error) => {
            console.error('Delete error:', error)
            const message = extractErrorMessage(error, 'Failed to delete theme')
            addNotification(message, 'error')
        }
    })

    // Preview mutation
    const previewMutation = useMutation({
        mutationFn: async () => {
            return await themesApi.getPreview(theme.id)
        },
        onSuccess: (data) => {
            setPreviewData(data)
            setShowPreview(true)
        },
        onError: (error) => {
            console.error('Preview error:', error)
            const message = extractErrorMessage(error, 'Failed to load theme preview')
            addNotification(message, 'error')
        }
    })

    const handleDelete = async (e) => {
        e.stopPropagation()

        // Simple confirmation using window.confirm for now
        const confirmed = window.confirm(`Are you sure you want to delete "${theme.name}"?`)
        if (confirmed) {
            try {
                await deleteMutation.mutateAsync()
            } catch (error) {
                // Error is already handled in the mutation
            }
        }
    }

    const handlePreview = (e) => {
        e.stopPropagation()
        previewMutation.mutate()
    }

    // Close preview on escape key
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && showPreview) {
                setShowPreview(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [showPreview])

    const generateThemeThumbnail = (theme) => {
        // If theme has an image, use that
        if (theme.image) {
            return (
                <div className="w-full h-24 bg-gray-100 rounded-t-lg overflow-hidden">
                    <img
                        src={theme.image}
                        alt={`${theme.name} theme`}
                        className="w-full h-full object-cover"
                    />
                </div>
            )
        }

        // Fallback: Generate a simple color preview based on theme variables
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
                            {(theme.isActive ?? theme.is_active) ? (
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
                            onClick={handlePreview}
                            disabled={previewMutation.isPending}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded disabled:opacity-50"
                            title={previewMutation.isPending ? "Loading preview..." : "Preview theme"}
                        >
                            <Eye className="w-4 h-4" />
                        </button>

                        <button
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                            title={deleteMutation.isPending ? "Deleting..." : "Delete"}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && previewData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">
                                Preview: {theme.name}
                            </h3>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {/* Theme Info */}
                            <div className="mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-2">Theme Information</h4>
                                        <p className="text-sm text-gray-600">{theme.description || 'No description'}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-2">Statistics</h4>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>{Object.keys(theme.css_variables || {}).length} CSS variables</p>
                                            <p>{Object.keys(theme.html_elements || {}).length} HTML element styles</p>
                                            <p>{Object.keys(theme.image_styles || {}).length} image styles</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sample Content with Theme Applied */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                    <h4 className="font-medium text-gray-900">Theme Preview</h4>
                                </div>
                                <div className="p-6">
                                    <style>
                                        {previewData.css || ''}
                                    </style>
                                    <div
                                        className="theme-content"
                                        dangerouslySetInnerHTML={{
                                            __html: previewData.sample_html || `
                                                <h1>Sample Heading 1</h1>
                                                <h2>Sample Heading 2</h2>
                                                <h3>Sample Heading 3</h3>
                                                <p>This is a sample paragraph to demonstrate how text looks with this theme. It includes <a href="#">a sample link</a> to show link styling.</p>
                                                <ul>
                                                    <li>Sample list item one</li>
                                                    <li>Sample list item two</li>
                                                    <li>Sample list item three</li>
                                                </ul>
                                                <blockquote>
                                                    This is a sample blockquote to demonstrate quote styling in this theme.
                                                </blockquote>
                                            `
                                        }}
                                    />
                                </div>
                            </div>

                            {/* CSS Variables Display */}
                            {Object.keys(theme.css_variables || {}).length > 0 && (
                                <div className="mt-6">
                                    <h4 className="font-medium text-gray-900 mb-3">CSS Variables</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {Object.entries(theme.css_variables || {}).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <span className="text-sm font-mono text-gray-700">--{key}</span>
                                                <div className="flex items-center space-x-2">
                                                    {value.startsWith('#') && (
                                                        <div
                                                            className="w-4 h-4 rounded border border-gray-300"
                                                            style={{ backgroundColor: value }}
                                                        />
                                                    )}
                                                    <span className="text-sm font-mono text-gray-600">{value}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Image Styles Display */}
                            {Object.keys(theme.image_styles || {}).length > 0 && (
                                <div className="mt-6">
                                    <h4 className="font-medium text-gray-900 mb-3">Image Styles</h4>
                                    <div className="space-y-3">
                                        {Object.entries(theme.image_styles || {}).map(([styleName, styleConfig]) => (
                                            <div key={styleName} className="p-3 bg-gray-50 rounded">
                                                <h5 className="font-medium text-gray-800 mb-2">{styleName}</h5>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                                                    <span>Align: {styleConfig.alignment || 'center'}</span>
                                                    <span>Cols: {styleConfig.galleryColumns || 3}</span>
                                                    <span>Space: {styleConfig.spacing || 'normal'}</span>
                                                    <span>Shadow: {styleConfig.shadow || 'sm'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Comprehensive theme templates with CSS Variables, HTML Elements, and Image Styles
const themeTemplates = {
    'Blue Theme': {
        cssVariables: {
            'primary': '#3b82f6',
            'primary-dark': '#1d4ed8',
            'primary-light': '#93c5fd',
            'secondary': '#64748b',
            'accent': '#06b6d4',
            'background': '#ffffff',
            'surface': '#f8fafc',
            'text': '#1f2937',
            'text-muted': '#6b7280',
            'border': '#e5e7eb',
            'shadow': 'rgba(59, 130, 246, 0.1)'
        },
        htmlElements: {
            'h1': {
                'color': 'var(--primary)',
                'font-size': '2.25rem',
                'font-weight': '700',
                'line-height': '1.2',
                'margin-bottom': '1rem'
            },
            'h2': {
                'color': 'var(--primary-dark)',
                'font-size': '1.875rem',
                'font-weight': '600',
                'line-height': '1.3',
                'margin-bottom': '0.75rem'
            },
            'p': {
                'color': 'var(--text)',
                'line-height': '1.6',
                'margin-bottom': '1rem'
            },
            'a': {
                'color': 'var(--accent)',
                'text-decoration': 'underline'
            },
            'a:hover': {
                'color': 'var(--primary)',
                'text-decoration': 'none'
            }
        },
        imageStyles: {
            'Default': {
                alignment: 'center',
                galleryColumns: 3,
                spacing: 'normal',
                borderRadius: 'normal',
                shadow: 'sm'
            },
            'Hero Banner': {
                alignment: 'center',
                galleryColumns: 1,
                spacing: 'loose',
                borderRadius: 'large',
                shadow: 'lg'
            }
        }
    },
    'Dark Theme': {
        cssVariables: {
            'primary': '#8b5cf6',
            'primary-dark': '#7c3aed',
            'primary-light': '#c4b5fd',
            'secondary': '#64748b',
            'accent': '#f59e0b',
            'background': '#111827',
            'surface': '#1f2937',
            'text': '#f9fafb',
            'text-muted': '#d1d5db',
            'border': '#374151',
            'shadow': 'rgba(139, 92, 246, 0.2)'
        },
        htmlElements: {
            'h1': {
                'color': 'var(--primary-light)',
                'font-size': '2.25rem',
                'font-weight': '700',
                'line-height': '1.2',
                'margin-bottom': '1rem'
            },
            'h2': {
                'color': 'var(--primary)',
                'font-size': '1.875rem',
                'font-weight': '600',
                'line-height': '1.3',
                'margin-bottom': '0.75rem'
            },
            'p': {
                'color': 'var(--text)',
                'line-height': '1.6',
                'margin-bottom': '1rem'
            },
            'a': {
                'color': 'var(--accent)',
                'text-decoration': 'underline'
            },
            'a:hover': {
                'color': 'var(--primary-light)',
                'text-decoration': 'none'
            },
            'blockquote': {
                'border-left': '4px solid var(--primary)',
                'padding-left': '1rem',
                'font-style': 'italic',
                'color': 'var(--text-muted)'
            }
        },
        imageStyles: {
            'Default': {
                alignment: 'center',
                galleryColumns: 3,
                spacing: 'normal',
                borderRadius: 'normal',
                shadow: 'lg'
            },
            'Dark Gallery': {
                alignment: 'center',
                galleryColumns: 4,
                spacing: 'tight',
                borderRadius: 'large',
                shadow: 'lg'
            }
        }
    },
    'Green Theme': {
        cssVariables: {
            'primary': '#10b981',
            'primary-dark': '#059669',
            'primary-light': '#6ee7b7',
            'secondary': '#64748b',
            'accent': '#f59e0b',
            'background': '#ffffff',
            'surface': '#f0fdf4',
            'text': '#065f46',
            'text-muted': '#6b7280',
            'border': '#d1fae5',
            'shadow': 'rgba(16, 185, 129, 0.1)'
        },
        htmlElements: {
            'h1': {
                'color': 'var(--primary-dark)',
                'font-size': '2.25rem',
                'font-weight': '700',
                'line-height': '1.2',
                'margin-bottom': '1rem'
            },
            'h2': {
                'color': 'var(--primary)',
                'font-size': '1.875rem',
                'font-weight': '600',
                'line-height': '1.3',
                'margin-bottom': '0.75rem'
            },
            'p': {
                'color': 'var(--text)',
                'line-height': '1.6',
                'margin-bottom': '1rem'
            },
            'a': {
                'color': 'var(--primary)',
                'text-decoration': 'underline'
            },
            'a:hover': {
                'color': 'var(--accent)',
                'text-decoration': 'none'
            },
            'ul': {
                'list-style-type': 'disc',
                'padding-left': '1.5rem',
                'color': 'var(--text)'
            },
            'li': {
                'margin-bottom': '0.25rem'
            }
        },
        imageStyles: {
            'Default': {
                alignment: 'center',
                galleryColumns: 3,
                spacing: 'normal',
                borderRadius: 'normal',
                shadow: 'sm'
            },
            'Nature Gallery': {
                alignment: 'center',
                galleryColumns: 2,
                spacing: 'loose',
                borderRadius: 'large',
                shadow: 'sm'
            },
            'Compact Grid': {
                alignment: 'left',
                galleryColumns: 5,
                spacing: 'tight',
                borderRadius: 'none',
                shadow: 'none'
            }
        }
    }
}

// Initial Theme Setup Component - For new themes only
const ThemeInitialSetup = ({ onComplete, onCancel }) => {
    const { addNotification } = useGlobalNotifications()
    const [setupData, setSetupData] = useState({
        name: '',
        description: '',
        selectedTemplate: '',
        isActive: true,
        isDefault: false
    })
    const [selectedImage, setSelectedImage] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)

    // Handle image file selection
    const handleImageSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                addNotification('Please select a valid image file', 'error')
                return
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                addNotification('Image file size must be less than 5MB', 'error')
                return
            }

            setSelectedImage(file)

            // Create preview
            const reader = new FileReader()
            reader.onload = (e) => {
                setImagePreview(e.target.result)
            }
            reader.readAsDataURL(file)
        }
    }

    // Remove selected image
    const removeImage = () => {
        setSelectedImage(null)
        setImagePreview(null)
    }

    // Mutation for creating the theme
    const mutation = useMutation({
        mutationFn: async (data) => {
            console.log('Creating theme with data:', data)
            console.log('Selected image:', selectedImage)

            // If there's an image, create FormData for multipart upload
            if (selectedImage) {
                console.log('Creating FormData for image upload')
                const formData = new FormData()
                formData.append('image', selectedImage)

                // Append other theme data as JSON
                Object.keys(data).forEach(key => {
                    if (key !== 'image') {
                        const value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]
                        formData.append(key, value)
                        console.log(`Added to FormData: ${key} =`, value)
                    }
                })

                console.log('Calling themesApi.createWithImage')
                return await themesApi.createWithImage(formData)
            } else {
                console.log('No image, calling regular create')
                return await themesApi.create(data)
            }
        },
        onSuccess: (data) => {
            addNotification(`Theme "${setupData.name}" created successfully`, 'success', 'theme-create')
            // Pass the created theme data to continue to main editor
            onComplete(data)
        },
        onError: (error) => {
            const message = extractErrorMessage(error, 'Failed to create theme')

            // Check if it's a duplicate name error and provide helpful guidance
            if (message.toLowerCase().includes('name already exists') || message.toLowerCase().includes('already exists')) {
                addNotification(`Theme name "${setupData.name}" already exists. Please choose a different name.`, 'error', 'theme-create')
            } else {
                addNotification(message, 'error', 'theme-create')
            }

            console.error(error)
            // Note: We don't reset form data on error so user doesn't lose their input
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!setupData.name.trim()) {
            addNotification('Theme name is required', 'error')
            return
        }
        if (!setupData.selectedTemplate) {
            addNotification('Please select a template to initialize your theme', 'error')
            return
        }

        // Get template data
        const templateData = themeTemplates[setupData.selectedTemplate]
        if (!templateData) {
            addNotification('Selected template not found', 'error')
            return
        }

        // Create initial theme data with template applied
        const initialThemeData = {
            name: setupData.name,
            description: setupData.description,
            cssVariables: templateData.cssVariables,
            htmlElements: templateData.htmlElements,
            imageStyles: templateData.imageStyles,
            customCss: '',
            isActive: setupData.isActive,
            isDefault: setupData.isDefault
        }

        // Actually create the theme via API
        mutation.mutate(initialThemeData)
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Create New Theme
                    <small className="pl-2 text-gray-600 text-sm">Start by choosing a name and template. You'll be able to customize everything afterwards.</small></h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">


                {/* Required Fields */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                        <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2">1</span>
                        Required Information
                    </h5>

                    <div className="space-y-4">
                        {/* Theme Name */}
                        <div>
                            <label htmlFor="setup-theme-name" className="block text-sm font-medium text-gray-700 mb-1">
                                Theme Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="setup-theme-name"
                                value={setupData.name}
                                onChange={(e) => setSetupData({ ...setupData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Enter theme name"
                                required
                            />
                        </div>

                        {/* Template Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Choose Template <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {Object.entries(themeTemplates).map(([templateName, templateData]) => (
                                    <div
                                        key={templateName}
                                        className={`relative cursor-pointer rounded-lg border-2 p-4 hover:border-purple-300 transition-colors ${setupData.selectedTemplate === templateName
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-gray-200 bg-white'
                                            }`}
                                        onClick={() => setSetupData({ ...setupData, selectedTemplate: templateName })}
                                    >
                                        <div className="flex items-center">
                                            <input
                                                type="radio"
                                                name="template"
                                                value={templateName}
                                                checked={setupData.selectedTemplate === templateName}
                                                onChange={() => setSetupData({ ...setupData, selectedTemplate: templateName })}
                                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                            />
                                            <label className="ml-3 cursor-pointer">
                                                <div className="text-sm font-medium text-gray-900">{templateName}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {Object.keys(templateData.cssVariables).length} variables,
                                                    {Object.keys(templateData.htmlElements).length} elements,
                                                    {Object.keys(templateData.imageStyles).length} image styles
                                                </div>
                                            </label>
                                        </div>

                                        {/* Color Preview */}
                                        <div className="flex space-x-1 mt-3">
                                            <div
                                                className="w-4 h-4 rounded-full border border-gray-300"
                                                style={{ backgroundColor: templateData.cssVariables.primary }}
                                                title="Primary Color"
                                            />
                                            <div
                                                className="w-4 h-4 rounded-full border border-gray-300"
                                                style={{ backgroundColor: templateData.cssVariables.background }}
                                                title="Background Color"
                                            />
                                            <div
                                                className="w-4 h-4 rounded-full border border-gray-300"
                                                style={{ backgroundColor: templateData.cssVariables.accent }}
                                                title="Accent Color"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {!setupData.selectedTemplate && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Select a template to get started with pre-configured colors, typography, and styles.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Optional Fields */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                        <span className="bg-gray-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2">2</span>
                        Optional Settings
                    </h5>

                    <div className="space-y-4">
                        {/* Description */}
                        <div>
                            <label htmlFor="setup-description" className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                id="setup-description"
                                value={setupData.description}
                                onChange={(e) => setSetupData({ ...setupData, description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Brief description of this theme's purpose or style..."
                            />
                        </div>

                        {/* Theme Image Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Theme Image
                            </label>

                            {!imagePreview ? (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                        id="theme-image-upload"
                                    />
                                    <label
                                        htmlFor="theme-image-upload"
                                        className="cursor-pointer flex flex-col items-center"
                                    >
                                        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-600">Click to upload theme image</span>
                                        <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
                                    </label>
                                </div>
                            ) : (
                                <div className="relative">
                                    <img
                                        src={imagePreview}
                                        alt="Theme preview"
                                        className="w-full h-32 object-cover rounded-lg border border-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                        title="Remove image"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                                Optional image to represent this theme in listings and previews.
                            </p>
                        </div>

                        {/* Status Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="setup-active"
                                    checked={setupData.isActive}
                                    onChange={(e) => setSetupData({ ...setupData, isActive: e.target.checked })}
                                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                />
                                <label htmlFor="setup-active" className="ml-2 text-sm text-gray-700">
                                    Theme is active
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="setup-default"
                                    checked={setupData.isDefault}
                                    onChange={(e) => setSetupData({ ...setupData, isDefault: e.target.checked })}
                                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                />
                                <label htmlFor="setup-default" className="ml-2 text-sm text-gray-700">
                                    Set as default theme
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="inline-flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Palette className="w-4 h-4 mr-2" />
                        {mutation.isPending ? 'Creating Theme...' : 'Create Theme & Continue'}
                    </button>
                </div>
            </form>
        </div>
    )
}

// Theme Form Component - Full featured version with tabs
const ThemeForm = ({ theme = null, onSave, onCancel }) => {
    const { addNotification } = useGlobalNotifications()
    const [formData, setFormData] = useState({
        name: theme?.name || '',
        description: theme?.description || '',
        cssVariables: theme?.cssVariables || {},
        htmlElements: theme?.htmlElements || {},
        imageStyles: theme?.imageStyles || {},
        customCss: theme?.customCss || '',
        isActive: theme?.isActive ?? true,
        isDefault: theme?.isDefault ?? false
    })
    const [showInitialSetup, setShowInitialSetup] = useState(!theme) // Show setup for new themes
    const [selectedImage, setSelectedImage] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)

    const [newVariable, setNewVariable] = useState({ key: '', value: '' })
    const [showCssEditor, setShowCssEditor] = useState(false)
    const [activeTab, setActiveTab] = useState('variables')
    const [showTabDropdown, setShowTabDropdown] = useState(false)

    // Handle image file selection for edit theme
    const handleImageSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                addNotification('Please select a valid image file', 'error')
                return
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                addNotification('Image file size must be less than 5MB', 'error')
                return
            }

            // For existing themes, save image immediately
            if (theme) {
                setSelectedImage(file)

                // Create preview
                const reader = new FileReader()
                reader.onload = (e) => {
                    setImagePreview(e.target.result)
                }
                reader.readAsDataURL(file)

                // Save image immediately
                imageUploadMutation.mutate(file)
            } else {
                // For new themes, just set the image for later submission
                setSelectedImage(file)

                // Create preview
                const reader = new FileReader()
                reader.onload = (e) => {
                    setImagePreview(e.target.result)
                }
                reader.readAsDataURL(file)
            }
        }
    }

    // Remove selected image
    const removeImage = () => {
        setSelectedImage(null)
        setImagePreview(null)
    }

    // Immediate image upload mutation for edit theme
    const imageUploadMutation = useMutation({
        mutationFn: async (imageFile) => {
            return await themesApi.updateImage(theme.id, imageFile)
        },
        onSuccess: (updatedTheme) => {
            addNotification('Theme image updated successfully', 'success', 'theme-image')
            // Update the theme data in parent component
            onSave(updatedTheme)
            // Clear the local image state since it's now saved
            setSelectedImage(null)
            setImagePreview(null)
        },
        onError: (error) => {
            const message = extractErrorMessage(error, 'Failed to update theme image')
            addNotification(message, 'error', 'theme-image')
            console.error('Image upload error:', error)
            // Keep the preview so user can try again
        }
    })

    // Handle initial setup completion
    const handleInitialSetupComplete = (createdTheme) => {
        // The theme has been created via API, now pass it up to the main handler
        // which will navigate to the newly created theme
        onSave(createdTheme)
    }

    // Define tabs configuration
    const tabs = [
        { id: 'variables', label: 'CSS Variables', icon: Hash },
        { id: 'elements', label: 'HTML Elements', icon: Type },
        { id: 'imageStyles', label: 'Image Styles', icon: ImageIcon },
        { id: 'custom', label: 'Custom CSS', icon: Settings },
        { id: 'editTheme', label: 'Edit Theme', icon: Edit3 }
    ]

    const activeTabData = tabs.find(tab => tab.id === activeTab)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showTabDropdown && !event.target.closest('.tab-dropdown')) {
                setShowTabDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showTabDropdown])

    const mutation = useMutation({
        mutationFn: async (data) => {
            console.log('ThemeForm mutation - data:', data)
            console.log('ThemeForm mutation - selectedImage:', selectedImage)
            console.log('ThemeForm mutation - theme:', theme)

            // Handle image uploads for both create and update
            if (selectedImage) {
                console.log('Creating FormData for image upload')
                const formData = new FormData()
                formData.append('image', selectedImage)

                // Append other theme data as JSON
                Object.keys(data).forEach(key => {
                    if (key !== 'image') {
                        const value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]
                        formData.append(key, value)
                        console.log(`Added to FormData: ${key} =`, value)
                    }
                })

                if (theme) {
                    console.log('Calling updateWithImage for theme ID:', theme.id)
                    return await themesApi.updateWithImage(theme.id, formData)
                } else {
                    console.log('Calling createWithImage')
                    return await themesApi.createWithImage(formData)
                }
            } else {
                if (theme) {
                    console.log('No image, calling regular update for theme ID:', theme.id)
                    return await themesApi.update(theme.id, data)
                } else {
                    console.log('No image, calling regular create')
                    return await themesApi.create(data)
                }
            }
        },
        onSuccess: (data) => {
            addNotification(`Theme ${theme ? 'updated' : 'created'} successfully`, 'success', 'theme-save')
            // Pass the updated theme data back for updates, or just call onSave for creates
            if (theme) {
                onSave(data) // For updates, pass the updated data
            } else {
                onSave() // For creates, just signal completion
            }
        },
        onError: (error) => {
            const message = extractErrorMessage(error, `Failed to ${theme ? 'update' : 'create'} theme`)
            addNotification(message, 'error', 'theme-save')
            console.error(error)
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            addNotification('Theme name is required', 'error')
            return
        }
        mutation.mutate(formData)
    }

    const addVariable = () => {
        if (newVariable.key && newVariable.value) {
            setFormData({
                ...formData,
                cssVariables: {
                    ...formData.cssVariables,
                    [newVariable.key]: newVariable.value
                }
            })
            setNewVariable({ key: '', value: '' })
        }
    }

    const removeVariable = (key) => {
        const updatedVariables = { ...formData.cssVariables }
        delete updatedVariables[key]
        setFormData({
            ...formData,
            cssVariables: updatedVariables
        })
    }

    const updateVariable = (oldKey, newKey, value) => {
        const updatedVariables = { ...formData.cssVariables }
        if (oldKey !== newKey) {
            delete updatedVariables[oldKey]
        }
        updatedVariables[newKey] = value
        setFormData({
            ...formData,
            cssVariables: updatedVariables
        })
    }


    const initThemeTemplate = (template) => {
        const templateData = themeTemplates[template]
        if (!templateData) return

        setFormData({
            ...formData,
            cssVariables: {
                ...formData.cssVariables,
                ...templateData.cssVariables
            },
            htmlElements: {
                ...formData.htmlElements,
                ...templateData.htmlElements
            },
            imageStyles: {
                ...formData.imageStyles,
                ...templateData.imageStyles
            }
        })
        addNotification(`Applied ${template} template with CSS variables, HTML elements, and image styles`, 'success', 'theme-template')
    }

    // Show initial setup for new themes, main editor for existing themes or after setup
    if (showInitialSetup) {
        return <ThemeInitialSetup onComplete={handleInitialSetupComplete} onCancel={onCancel} />
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                    {theme ? 'Edit Theme' : 'Create New Theme'}
                </h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Responsive Tab Navigation */}
                <div className="border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        {/* Desktop: Horizontal tabs (hidden on small screens) */}
                        <nav className="hidden md:flex -mb-px space-x-8 flex-1">
                            {tabs.map((tab) => {
                                const IconComponent = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center ${activeTab === tab.id
                                            ? 'border-purple-500 text-purple-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
                                        <span className="truncate">{tab.label}</span>
                                    </button>
                                )
                            })}
                        </nav>

                        {/* Mobile/Compact: Dropdown menu */}
                        <div className="md:hidden flex-1">
                            <div className="relative tab-dropdown">
                                <button
                                    type="button"
                                    onClick={() => setShowTabDropdown(!showTabDropdown)}
                                    className="w-full flex items-center justify-between py-2 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <div className="flex items-center">
                                        {activeTabData && (
                                            <>
                                                <activeTabData.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                                                <span className="truncate">{activeTabData.label}</span>
                                            </>
                                        )}
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showTabDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showTabDropdown && (
                                    <div className="absolute right-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10">
                                        {tabs.map((tab) => {
                                            const IconComponent = tab.icon
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveTab(tab.id)
                                                        setShowTabDropdown(false)
                                                    }}
                                                    className={`w-full flex items-center px-3 py-2 text-sm text-left hover:bg-gray-50 ${activeTab === tab.id ? 'bg-purple-50 text-purple-600' : 'text-gray-700'
                                                        }`}
                                                >
                                                    <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
                                                    <span className="truncate">{tab.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Desktop: When tabs overflow, show dropdown on the right */}
                        <div className="hidden xl:block relative ml-4 tab-dropdown">
                            <button
                                type="button"
                                onClick={() => setShowTabDropdown(!showTabDropdown)}
                                className="flex items-center px-3 py-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                title="More options"
                            >
                                <Menu className="w-4 h-4" />
                            </button>

                            {showTabDropdown && (
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                                    {tabs.map((tab) => {
                                        const IconComponent = tab.icon
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab(tab.id)
                                                    setShowTabDropdown(false)
                                                }}
                                                className={`w-full flex items-center px-3 py-2 text-sm text-left hover:bg-gray-50 ${activeTab === tab.id ? 'bg-purple-50 text-purple-600' : 'text-gray-700'
                                                    }`}
                                            >
                                                <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
                                                <span className="truncate">{tab.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'variables' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    CSS Variables
                                </label>
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCssEditor(!showCssEditor)}
                                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                        {showCssEditor ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                        {showCssEditor ? 'Hide' : 'Show'} CSS
                                    </button>
                                </div>
                            </div>


                            {/* Add New Variable */}
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Variable name (e.g., primary-color)"
                                        value={newVariable.key}
                                        onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
                                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Value (e.g., #3b82f6)"
                                        value={newVariable.value}
                                        onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={addVariable}
                                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                                        aria-label="Add variable"
                                        title="Add variable"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Variables List */}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {Object.entries(formData.cssVariables).map(([key, value]) => (
                                    <VariableEditor
                                        key={key}
                                        originalKey={key}
                                        value={value}
                                        onUpdate={(newKey, newValue) => updateVariable(key, newKey, newValue)}
                                        onRemove={() => removeVariable(key)}
                                    />
                                ))}

                                {Object.keys(formData.cssVariables).length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Hash className="w-8 h-8 mx-auto mb-3" />
                                        <p className="text-sm mb-2">No CSS variables defined yet.</p>
                                        <p className="text-xs text-gray-500">
                                            Add your first variable above to customize your theme's colors and styles.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* CSS Preview */}
                            {showCssEditor && (
                                <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                                    <div className="text-xs text-gray-300 mb-2">Generated CSS Variables</div>
                                    <pre className="text-xs text-green-300 overflow-x-auto">
                                        <code>
                                            {`:root {\n${Object.entries(formData.cssVariables)
                                                .map(([key, value]) => `  --${key}: ${value};`)
                                                .join('\n')}\n}`}
                                        </code>
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'elements' && (
                        <HtmlElementStyleEditor
                            htmlElements={formData.htmlElements}
                            onChange={(htmlElements) => setFormData({ ...formData, htmlElements })}
                            showPreview={showCssEditor}
                        />
                    )}

                    {activeTab === 'imageStyles' && (
                        <ImageStylesEditor
                            imageStyles={formData.imageStyles}
                            onChange={(imageStyles) => setFormData({ ...formData, imageStyles })}
                        />
                    )}

                    {activeTab === 'custom' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="theme-custom-css" className="block text-sm font-medium text-gray-700">
                                    Custom CSS
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowCssEditor(!showCssEditor)}
                                    className="text-xs text-purple-600 hover:text-purple-700"
                                >
                                    {showCssEditor ? 'Hide Editor' : 'Show Editor'}
                                </button>
                            </div>

                            {showCssEditor && (
                                <textarea
                                    id="theme-custom-css"
                                    value={formData.customCss}
                                    onChange={(e) => setFormData({ ...formData, customCss: e.target.value })}
                                    rows={12}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                    placeholder={`/* Additional custom CSS for this theme */\n.theme-content h1 {\n  /* Your styles here */\n}\n\n.theme-content {\n  background: var(--background);\n  color: var(--text);\n}`}
                                />
                            )}

                            {!showCssEditor && formData.customCss && (
                                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                    {formData.customCss.split('\n').length} lines of custom CSS defined
                                </div>
                            )}

                            <p className="text-xs text-gray-500 mt-1">
                                Additional CSS that will be included with this theme. You can reference CSS variables using var(--variable-name).
                                CSS will be automatically scoped to .theme-content elements.
                            </p>
                        </div>
                    )}

                    {activeTab === 'editTheme' && (
                        <div>
                            <div className="space-y-6">
                                {/* Theme Basic Information */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Theme Settings</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="theme-name" className="block text-sm font-medium text-gray-700 mb-1">
                                                Theme Name
                                            </label>
                                            <input
                                                type="text"
                                                id="theme-name"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="Enter theme name"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="theme-description" className="block text-sm font-medium text-gray-700 mb-1">
                                                Description
                                            </label>
                                            <input
                                                type="text"
                                                id="theme-description"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="Brief description of the theme"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Theme Image */}
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 mb-3">Theme Image</h4>

                                    <div className="mb-4">
                                        <div className="relative inline-block">
                                            {imagePreview ? (
                                                <img
                                                    src={imagePreview}
                                                    alt="New theme image preview"
                                                    className="w-48 h-32 object-cover rounded-lg border border-purple-300"
                                                />
                                            ) : theme?.image ? (
                                                <img
                                                    src={theme.image}
                                                    alt={`${theme.name} theme`}
                                                    className="w-48 h-32 object-cover rounded-lg border border-gray-300"
                                                />
                                            ) : (
                                                <div className="w-48 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                                    <div className="text-center">
                                                        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                                        <span className="text-xs text-gray-500">No image set</span>
                                                    </div>
                                                </div>
                                            )}

                                            {imagePreview && (
                                                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                                    <span className="text-white text-sm">New image preview</span>
                                                </div>
                                            )}

                                            {!imagePreview && theme?.image && (
                                                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                                    <span className="text-white text-sm">Current theme image</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            id="edit-theme-image"
                                            onChange={handleImageSelect}
                                            disabled={imageUploadMutation.isPending}
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            <label
                                                htmlFor="edit-theme-image"
                                                className={`inline-flex items-center px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${imageUploadMutation.isPending
                                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                    }`}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                {imageUploadMutation.isPending
                                                    ? 'Uploading...'
                                                    : imagePreview
                                                        ? 'Change Image'
                                                        : theme?.image
                                                            ? 'Change Image'
                                                            : 'Upload Image'
                                                }
                                            </label>

                                            {imagePreview && (
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                                    onClick={removeImage}
                                                >
                                                    <X className="w-4 h-4 mr-2" />
                                                    Cancel Upload
                                                </button>
                                            )}

                                            {!imagePreview && theme?.image && (
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center px-3 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                                                    onClick={() => {
                                                        // TODO: Implement image removal from server
                                                        console.log('Remove theme image from server')
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Remove Image
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-500 mt-2">
                                        Upload an image to represent this theme in listings and previews. Maximum file size: 5MB.
                                    </p>
                                </div>

                                {/* Theme Status */}
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 mb-3">Status & Settings</h4>

                                    <div className="space-y-3">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="theme-active"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                            />
                                            <label htmlFor="theme-active" className="ml-2 text-sm text-gray-700">
                                                Theme is active
                                            </label>
                                        </div>

                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="theme-default"
                                                checked={formData.isDefault}
                                                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                            />
                                            <label htmlFor="theme-default" className="ml-2 text-sm text-gray-700">
                                                Set as default theme
                                            </label>
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-500 mt-2">
                                        The default theme will be applied to new content automatically. Only one theme can be set as default.
                                    </p>
                                </div>

                                {/* Theme Statistics */}
                                {theme && (
                                    <div>
                                        <h4 className="text-md font-medium text-gray-900 mb-3">Theme Information</h4>

                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Variables</span>
                                                    <p className="font-medium">{Object.keys(formData.cssVariables).length}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">HTML Elements</span>
                                                    <p className="font-medium">{Object.keys(formData.htmlElements).length}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Image Styles</span>
                                                    <p className="font-medium">{Object.keys(formData.imageStyles).length}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Custom CSS</span>
                                                    <p className="font-medium">{formData.customCss ? 'Yes' : 'No'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {mutation.isPending ? 'Saving...' : (theme ? 'Update Theme' : 'Create Theme')}
                    </button>
                </div>
            </form>
        </div>
    )
}

const ThemeEditPanel = ({ theme, onUpdate, onCancel }) => {
    const handleSave = (updatedThemeData) => {
        // For updates, pass the data; for creates, just signal completion
        onUpdate(updatedThemeData)
    }

    return <ThemeForm theme={theme} onSave={handleSave} onCancel={onCancel} />
}

// Variable Editor Component
const VariableEditor = ({ originalKey, value, onUpdate, onRemove }) => {
    const [key, setKey] = useState(originalKey)
    const [val, setVal] = useState(value)
    const [isColor, setIsColor] = useState(false)

    useEffect(() => {
        // Check if value looks like a color
        const colorPattern = /^(#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\()/
        setIsColor(colorPattern.test(value))
    }, [value])

    const handleUpdate = () => {
        onUpdate(key, val)
    }

    return (
        <div className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg">
            <div className="flex-1 flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-mono">--</span>
                <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onBlur={handleUpdate}
                    className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none font-mono"
                />
                <span className="text-xs text-gray-500">:</span>
                {isColor && (
                    <input
                        type="color"
                        value={val.startsWith('#') ? val : '#000000'}
                        onChange={(e) => {
                            setVal(e.target.value)
                            onUpdate(key, e.target.value)
                        }}
                        className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                    />
                )}
                <input
                    type="text"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={handleUpdate}
                    className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none font-mono"
                />
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="text-red-600 hover:text-red-700"
                aria-label="remove variable"
                title="Remove variable"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    )
}

// Image Styles Editor Component
const ImageStylesEditor = ({ imageStyles, onChange }) => {
    const [newStyleName, setNewStyleName] = useState('')
    const [editingStyle, setEditingStyle] = useState(null)

    const addImageStyle = () => {
        if (!newStyleName.trim()) return

        const newStyle = {
            alignment: 'center',
            galleryColumns: 3,
            spacing: 'normal',
            borderRadius: 'normal',
            shadow: 'sm'
        }

        onChange({
            ...imageStyles,
            [newStyleName]: newStyle
        })
        setNewStyleName('')
    }

    const updateImageStyle = (styleName, updates) => {
        onChange({
            ...imageStyles,
            [styleName]: {
                ...imageStyles[styleName],
                ...updates
            }
        })
    }

    const deleteImageStyle = (styleName) => {
        const newStyles = { ...imageStyles }
        delete newStyles[styleName]
        onChange(newStyles)
    }

    const startEditing = (styleName) => {
        setEditingStyle(styleName)
    }

    const stopEditing = () => {
        setEditingStyle(null)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                    Image Styles
                </label>
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={newStyleName}
                        onChange={(e) => setNewStyleName(e.target.value)}
                        placeholder="Style name (e.g., 'Hero Banner')"
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        onKeyPress={(e) => e.key === 'Enter' && addImageStyle()}
                    />
                    <button
                        type="button"
                        onClick={addImageStyle}
                        className="inline-flex items-center px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Style
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {Object.keys(imageStyles).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No image styles defined</p>
                        <p className="text-sm">Add your first image style above</p>
                    </div>
                ) : (
                    Object.entries(imageStyles).map(([styleName, styleConfig]) => (
                        <div key={styleName} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900">{styleName}</h4>
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => editingStyle === styleName ? stopEditing() : startEditing(styleName)}
                                        className="text-gray-500 hover:text-purple-600"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteImageStyle(styleName)}
                                        className="text-gray-500 hover:text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {editingStyle === styleName ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Alignment</label>
                                        <select
                                            value={styleConfig.alignment || 'center'}
                                            onChange={(e) => updateImageStyle(styleName, { alignment: e.target.value })}
                                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gallery Columns</label>
                                        <select
                                            value={styleConfig.galleryColumns || 3}
                                            onChange={(e) => updateImageStyle(styleName, { galleryColumns: parseInt(e.target.value) })}
                                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            <option value={1}>1 Column</option>
                                            <option value={2}>2 Columns</option>
                                            <option value={3}>3 Columns</option>
                                            <option value={4}>4 Columns</option>
                                            <option value={5}>5 Columns</option>
                                            <option value={6}>6 Columns</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Spacing</label>
                                        <select
                                            value={styleConfig.spacing || 'normal'}
                                            onChange={(e) => updateImageStyle(styleName, { spacing: e.target.value })}
                                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            <option value="tight">Tight</option>
                                            <option value="normal">Normal</option>
                                            <option value="loose">Loose</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Border Radius</label>
                                        <select
                                            value={styleConfig.borderRadius || 'normal'}
                                            onChange={(e) => updateImageStyle(styleName, { borderRadius: e.target.value })}
                                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            <option value="none">None</option>
                                            <option value="normal">Normal</option>
                                            <option value="large">Large</option>
                                            <option value="full">Full (Circular)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Shadow</label>
                                        <select
                                            value={styleConfig.shadow || 'sm'}
                                            onChange={(e) => updateImageStyle(styleName, { shadow: e.target.value })}
                                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            <option value="none">None</option>
                                            <option value="sm">Small</option>
                                            <option value="lg">Large</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p><span className="font-medium">Alignment:</span> {styleConfig.alignment || 'center'}</p>
                                    <p><span className="font-medium">Columns:</span> {styleConfig.galleryColumns || 3}</p>
                                    <p><span className="font-medium">Spacing:</span> {styleConfig.spacing || 'normal'}</p>
                                    <p><span className="font-medium">Border Radius:</span> {styleConfig.borderRadius || 'normal'}</p>
                                    <p><span className="font-medium">Shadow:</span> {styleConfig.shadow || 'sm'}</p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default ThemeEditor
