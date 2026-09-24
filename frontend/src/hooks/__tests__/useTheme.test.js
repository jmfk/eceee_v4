import { describe, expect, it } from 'vitest'
import { getFrontendThemeCSSUrl } from '../useTheme'

describe('getFrontendThemeCSSUrl', () => {
    it('requests CSS scoped to the CMS content area', () => {
        const url = getFrontendThemeCSSUrl({
            id: 42,
            updatedAt: '2026-09-24T10:00:00Z',
        })
        const parsedUrl = new URL(url, 'http://localhost')

        expect(parsedUrl.pathname).toBe('/api/v1/webpages/themes/42/styles.css')
        expect(parsedUrl.searchParams.get('frontend_scoped')).toBe('true')
        expect(parsedUrl.searchParams.get('v')).toBe(String(Date.parse('2026-09-24T10:00:00Z')))
    })

    it('does not add an invalid cache version', () => {
        const url = getFrontendThemeCSSUrl({ id: 7 })
        const parsedUrl = new URL(url, 'http://localhost')

        expect(parsedUrl.searchParams.get('frontend_scoped')).toBe('true')
        expect(parsedUrl.searchParams.has('v')).toBe(false)
    })
})
