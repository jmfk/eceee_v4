import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi } from '../api/themes'

// The page version contains a theme snapshot. Refresh published outline presets
// independently so a return from Designer does not require reloading page edits.
export function usePublishedThemeOutlines(theme, enabled = true) {
    const id = theme?.id
    const { data } = useQuery({
        queryKey: ['published-theme-outlines', String(id)],
        queryFn: () => themesApi.get(id),
        enabled: enabled && !!id,
        staleTime: 30_000,
        refetchOnWindowFocus: 'always',
    })
    const styles = data?.textOutlineStyles ?? data?.text_outline_styles
    return useMemo(() => styles !== undefined ? {
        ...theme,
        textOutlineStyles: styles,
    } : theme, [styles, theme])
}
