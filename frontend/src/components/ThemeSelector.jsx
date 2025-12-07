/**
 * Theme Selector Component
 * 
 * Allows selecting and applying themes to pages.
 * Integrates with the theme system to apply CSS to content areas.
 */

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi } from '../api'
import { extractErrorMessage } from '../utils/errorHandling'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { Palette, Eye, EyeOff, Check, X } from 'lucide-react'

const ThemeSelector = ({
    selectedThemeId,
    effectiveThemeId,
    themeInheritanceInfo,
    onThemeChange
}) => {
    const [previewThemeId, setPreviewThemeId] = useState(null)
    const [showPreview, setShowPreview] = useState(false)
    const { addNotification } = useGlobalNotifications()

    // Fetch available themes
    const { data: themes = [], isLoading, error } = useQuery({
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
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Fetch selected theme details
    const { data: selectedTheme } = useQuery({
        queryKey: ['theme', selectedThemeId],
        queryFn: () => themesApi.get(selectedThemeId),
        enabled: !!selectedThemeId,
        staleTime: 5 * 60 * 1000,
    })

    // Fetch preview theme details
    const { data: previewTheme } = useQuery({
        queryKey: ['theme', previewThemeId],
        queryFn: () => themesApi.get(previewThemeId),
        enabled: !!previewThemeId && showPreview,
        staleTime: 5 * 60 * 1000,
    })

    // Handle theme selection
    const handleThemeSelect = (themeId) => {
        if (themeId !== selectedThemeId) {
            onThemeChange(themeId)
            addNotification('Theme applied to page', 'success', 'theme-apply')
        }
    }

    // Handle theme preview
    const handlePreviewToggle = (themeId) => {
        if (showPreview && previewThemeId === themeId) {
            setShowPreview(false)
            setPreviewThemeId(null)
        } else {
            setPreviewThemeId(themeId)
            setShowPreview(true)
        }
    }

    // Helper function to extract color variables for preview
    const getColorVariables = (cssVariables = {}) => {
        return Object.entries(cssVariables)
            .filter(([key, value]) =>
                typeof value === 'string' && (
                    value.startsWith('#') ||
                    value.startsWith('rgb') ||
                    value.startsWith('hsl') ||
                    /^[a-zA-Z]+$/.test(value) // Named colors
                )
            )
            .map(([, value]) => value)
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center bg-red-50">
                <div className="text-center text-red-600">
                    <Palette className="w-8 h-8 mx-auto mb-2" />
                    <p>Error loading themes</p>
                    <p className="text-sm">{extractErrorMessage(error, 'Failed to load themes')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full bg-white flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Page Theme</h2>
                        <p className="text-gray-600 mt-1">
                            Choose a theme to style content elements in this page
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {selectedTheme && (
                            <div className="text-sm text-gray-500">
                                Current: <span className="font-medium">{selectedTheme.name}</span>
                            </div>
                        )}
                    </div>
                    {selectedThemeId && (
                        <button
                            onClick={() => handleThemeSelect(null)}
                            className="text-sm text-blue-700 hover:text-blue-900 font-medium"
                        >
                            Clear Override
                        </button>
                    )}

                </div>
            </div>

            {/* Theme Inheritance Status Banner */}
            {themeInheritanceInfo && themeInheritanceInfo.source === 'inherited' && themeInheritanceInfo.inheritedFrom && (
                <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Palette className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-900">
                                Theme inherited from <span className="font-medium">{themeInheritanceInfo.inheritedFrom.pageTitle}</span>
                            </span>
                        </div>

                    </div>
                </div>
            )}
            {/* Content */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-6">
                        <div className="animate-pulse space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-6">
                        {/* Available Themes */}
                        <div className="space-y-4">
                            {themes.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Palette className="w-12 h-12 mx-auto mb-4" />
                                    <p className="text-lg font-medium">No themes available</p>
                                    <p className="text-sm mt-1">Create themes in the Theme Editor to style your content</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {themes.map((theme) => {
                                        const isSelected = selectedThemeId === theme.id
                                        const isEffective = effectiveThemeId === theme.id && !selectedThemeId

                                        return (
                                            <div
                                                key={theme.id}
                                                className={`border-2 rounded-lg overflow-hidden transition-all cursor-pointer flex flex-col ${isSelected
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : isEffective
                                                        ? 'border-blue-300 bg-blue-25'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {/* Theme Image */}
                                                {theme.image && (
                                                    <div className="w-full h-32 bg-gray-100 overflow-hidden flex-shrink-0">
                                                        <img
                                                            src={theme.image}
                                                            alt={theme.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}

                                                <div className="p-4 flex flex-col flex-1">
                                                    <div className="flex-1">
                                                        {/* Theme Header */}
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-2">
                                                                    <h4 className="font-medium text-gray-900">{theme.name}</h4>
                                                                    {theme.isDefault && !isEffective && (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                                                            Default
                                                                        </span>
                                                                    )}
                                                                    {isSelected && (
                                                                        <Check className="w-4 h-4 text-blue-600" />
                                                                    )}
                                                                    {isEffective && (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                            {themeInheritanceInfo?.source === 'inherited' ? 'Inherited' : 'Active (Default)'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {theme.description && (
                                                                    <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handlePreviewToggle(theme.id)
                                                                    }}
                                                                    className={`p-1 rounded text-xs transition-colors ${showPreview && previewThemeId === theme.id
                                                                        ? 'bg-purple-100 text-purple-700'
                                                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                                                        }`}
                                                                    title={showPreview && previewThemeId === theme.id ? 'Hide preview' : 'Show preview'}
                                                                >
                                                                    {showPreview && previewThemeId === theme.id ? (
                                                                        <EyeOff className="w-4 h-4" />
                                                                    ) : (
                                                                        <Eye className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Color Preview */}
                                                        <div className="flex items-center space-x-1 mb-3">
                                                            {getColorVariables(theme.cssVariables).slice(0, 6).map((color, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="w-6 h-6 rounded border border-gray-300"
                                                                    style={{ backgroundColor: color }}
                                                                    title={color}
                                                                />
                                                            ))}
                                                            {getColorVariables(theme.cssVariables).length > 6 && (
                                                                <span className="text-xs text-gray-400">
                                                                    +{getColorVariables(theme.cssVariables).length - 6}
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                {Object.keys(theme.cssVariables || {}).length} variables
                                                            </span>
                                                        </div>

                                                        {/* Available Styles */}
                                                        {(theme.componentStyles || theme.imageStyles || theme.tableTemplates) && (
                                                            <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                                                                <div className="text-xs font-medium text-gray-700 mb-2">Available Templates</div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {theme.componentStyles && Object.keys(theme.componentStyles).length > 0 && (
                                                                        <div>
                                                                            <div className="text-xs font-medium text-gray-700 mb-0.5">Components:</div>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {Object.keys(theme.componentStyles).map(styleName => (
                                                                                    <span key={styleName} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                                                                        {styleName}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {theme.imageStyles && Object.keys(theme.imageStyles).length > 0 && (
                                                                        <div>
                                                                            <div className="text-xs font-medium text-gray-700 mb-0.5">Image Styles:</div>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {Object.entries(theme.imageStyles).map(([styleName, style]) => (
                                                                                    <span key={styleName} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700" title={style.styleType}>
                                                                                        {styleName}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {theme.tableTemplates && Object.keys(theme.tableTemplates).length > 0 && (
                                                                        <div>
                                                                            <div className="text-xs font-medium text-gray-700 mb-0.5">Tables:</div>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {Object.keys(theme.tableTemplates).map(styleName => (
                                                                                    <span key={styleName} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                                                                        {styleName}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Theme Preview */}
                                                        {showPreview && previewThemeId === theme.id && previewTheme && (
                                                            <div className="mt-3 p-3 bg-gray-50 rounded border">
                                                                <h5 className="text-xs font-medium text-gray-700 mb-2">Preview</h5>
                                                                <ThemePreview theme={previewTheme} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Select Button */}
                                                    <button
                                                        onClick={() => handleThemeSelect(theme.id)}
                                                        className={`w-full mt-3 px-3 py-2 rounded text-sm font-medium transition-colors ${isSelected
                                                            ? 'bg-blue-600 text-white'
                                                            : isEffective
                                                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {isSelected ? 'Currently Selected' : isEffective ? (themeInheritanceInfo?.source === 'inherited' ? 'Inherited (Click to Override)' : 'Using Default (Click to Override)') : 'Select Theme'}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Current Theme Details */}
                        {selectedTheme && (
                            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h3 className="font-medium text-blue-900 mb-2">Applied Theme: {selectedTheme.name}</h3>
                                <div className="text-sm text-blue-800">
                                    <p>This theme will style all content elements including:</p>
                                    <ul className="mt-2 space-y-1 text-xs">
                                        <li>• Text content in ContentWidget editors and previews</li>
                                        <li>• Headers, paragraphs, lists, and other HTML elements</li>
                                        <li>• Widget content areas (not admin interfaces)</li>
                                    </ul>
                                    {Object.keys(selectedTheme.cssVariables || {}).length > 0 && (
                                        <p className="mt-2">
                                            <span className="font-medium">{Object.keys(selectedTheme.cssVariables).length} CSS variables</span>
                                            {selectedTheme.customCss && <span> and custom CSS</span>} defined.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// Mini Theme Preview Component
const ThemePreview = ({ theme }) => {
    const variables = theme.cssVariables || {}

    // Create style object from CSS variables
    const previewStyle = Object.entries(variables).reduce((acc, [key, value]) => {
        acc[`--${key}`] = value
        return acc
    }, {})

    return (
        <div className="text-xs space-y-2" style={previewStyle}>
            {/* Sample content styled with theme */}
            <div
                className="p-2 rounded"
                style={{
                    backgroundColor: variables.background || variables.surface || '#ffffff',
                    color: variables.text || '#1f2937'
                }}
            >
                <div
                    className="font-semibold"
                    style={{ color: variables.primary || '#3b82f6' }}
                >
                    Sample Heading
                </div>
                <div className="mt-1" style={{ color: variables['text-muted'] || variables.secondary || '#6b7280' }}>
                    Sample content text with theme styling applied.
                </div>
            </div>
        </div>
    )
}

export default ThemeSelector
