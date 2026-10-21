import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDefaultTheme } from '../hooks/useDefaultTheme'
import { themesApi } from '../api'
import { getCurrentTenantId } from '../utils/tenant'

export const WidgetThemeContext = createContext(null)
export const useWidgetTheme = (provided) => {
    const inherited = useContext(WidgetThemeContext)
    const theme = provided || inherited
    const { defaultTheme } = useDefaultTheme({ enabled: !theme })
    const base = theme || defaultTheme
    const themeId = typeof base === 'object' ? base?.id : base
    const { data: current } = useQuery({
        queryKey: ['themes', 'widget-definitions', getCurrentTenantId(), themeId, base?.syncVersion || base?.updatedAt],
        queryFn: async () => {
            const response = await themesApi.get(themeId)
            return response.data || response
        },
        enabled: Boolean(themeId),
        staleTime: 30_000,
    })
    return current || (typeof base === 'object' ? base : null)
}
