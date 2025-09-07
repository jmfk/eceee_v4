/**
 * Hook for managing the default theme used in object content editors.
 * 
 * This hook provides:
 * - Access to the current default theme
 * - CSS injection for the default theme
 * - Methods to ensure default theme exists
 */

import { useQuery } from '@tanstack/react-query'
import { useTheme } from './useTheme'
import { themesApi } from '../api'

export const useDefaultTheme = ({
    scopeSelector = '.theme-content',
    enabled = true,
    autoInject = true
} = {}) => {
    // Fetch the current default theme
    const {
        data: defaultTheme,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['themes', 'default'],
        queryFn: async () => {
            try {
                const response = await themesApi.getDefault()
                return response.data || response
            } catch (error) {
                // If no default theme exists, try to ensure one
                if (error.response?.status === 404) {
                    try {
                        const ensureResponse = await themesApi.ensureDefault()
                        return ensureResponse.data?.theme || ensureResponse.theme
                    } catch (ensureError) {
                        console.error('Failed to ensure default theme:', ensureError)
                        throw ensureError
                    }
                }
                throw error
            }
        },
        enabled: enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
    })

    // Use the theme hook to inject CSS if auto-injection is enabled
    const {
        injectTheme,
        removeTheme,
        isInjected
    } = useTheme({
        themeId: defaultTheme?.id,
        scopeSelector,
        enabled: enabled && autoInject && !!defaultTheme
    })

    /**
     * Manually inject the default theme CSS
     */
    const injectDefaultTheme = () => {
        if (defaultTheme) {
            injectTheme()
        }
    }

    /**
     * Remove the default theme CSS
     */
    const removeDefaultTheme = () => {
        removeTheme()
    }

    /**
     * Ensure a default theme exists
     */
    const ensureDefaultTheme = async () => {
        try {
            const response = await themesApi.ensureDefault()
            refetch() // Refresh the query
            return response.data?.theme || response.theme
        } catch (error) {
            console.error('Failed to ensure default theme:', error)
            throw error
        }
    }

    return {
        defaultTheme,
        isLoading,
        error,
        isInjected,
        injectDefaultTheme,
        removeDefaultTheme,
        ensureDefaultTheme,
        refetch
    }
}

export default useDefaultTheme
