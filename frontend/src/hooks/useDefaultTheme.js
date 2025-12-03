/**
 * Hook for managing the default theme used in object content editors.
 * 
 * This hook provides:
 * - Access to the current default theme data
 * - Methods to ensure default theme exists
 * 
 * Note: CSS injection should happen via useTheme with a pageId.
 * This hook only provides theme data access.
 */

import { useQuery } from '@tanstack/react-query'
import { themesApi } from '../api'

export const useDefaultTheme = ({
    enabled = true
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
        ensureDefaultTheme,
        refetch
    }
}

export default useDefaultTheme
