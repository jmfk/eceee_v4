import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi } from '../api'
import { Palette, Check } from 'lucide-react'

const ThemeSelector = ({
    selectedThemeId,
    effectiveThemeId,
    themeInheritanceInfo,
    onThemeChange
}) => {
    const { data: themes = [], isLoading, error } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            const response = await themesApi.list()
            if (Array.isArray(response)) return response
            if (response?.data && Array.isArray(response.data)) return response.data
            if (response?.results && Array.isArray(response.results)) return response.results
            return []
        },
        staleTime: 5 * 60 * 1000,
    })

    const isInherited = themeInheritanceInfo?.source === 'inherited'
    const inheritedFromName = themeInheritanceInfo?.inheritedFrom?.pageTitle
    const isRootPage = !isInherited && !inheritedFromName

    const sortedThemes = useMemo(() => {
        if (!themes.length) return themes
        const activeId = selectedThemeId || effectiveThemeId
        if (!activeId) return themes
        return [...themes].sort((a, b) => {
            if (a.id === activeId) return -1
            if (b.id === activeId) return 1
            return 0
        })
    }, [themes, selectedThemeId, effectiveThemeId])

    if (error) {
        return (
            <div className="h-full flex items-center justify-center bg-red-50">
                <div className="text-center text-red-600">
                    <Palette className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-sm">Failed to load themes</div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full bg-white flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-gray-900">Page Theme</div>
                    {selectedThemeId && !isRootPage && (
                        <button
                            onClick={() => onThemeChange(null)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Use inherited theme
                        </button>
                    )}
                </div>
                {isInherited && !selectedThemeId && inheritedFromName && (
                    <div className="text-sm text-gray-500 mt-1">
                        Inherited from {inheritedFromName}
                    </div>
                )}
            </div>

            {selectedThemeId && !isRootPage && (
                <div className="mx-4 mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <div className="text-xs text-amber-800">
                        This page overrides the theme inherited from {inheritedFromName || 'parent'}.
                        All child pages will inherit this override unless they define their own.
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : themes.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Palette className="w-10 h-10 mx-auto mb-3" />
                        <div className="text-sm">No themes available</div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sortedThemes.map((theme) => {
                            const isSelected = selectedThemeId === theme.id
                            const isEffective = effectiveThemeId === theme.id && !selectedThemeId

                            return (
                                <button
                                    key={theme.id}
                                    onClick={() => onThemeChange(theme.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50'
                                            : isEffective
                                                ? 'border-blue-200 bg-blue-50/50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="w-12 h-12 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                                        {theme.image ? (
                                            <img
                                                src={theme.image}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Palette className="w-5 h-5 text-gray-300" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {theme.name}
                                        </div>
                                        {isEffective && (
                                            <div className="text-xs text-blue-600">
                                                {isInherited ? 'Inherited' : 'Default'}
                                            </div>
                                        )}
                                    </div>

                                    {isSelected && (
                                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ThemeSelector
