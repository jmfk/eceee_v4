import { afterEach, describe, expect, it } from 'vitest'
import { registerRenderFont, unregisterRenderFont } from '../renderFontManager'

describe('render font manager', () => {
    const url = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700'

    afterEach(() => {
        unregisterRenderFont(url, 'preview-a')
        unregisterRenderFont(url, 'preview-b')
    })

    it('deduplicates a shared font link until its last render consumer unmounts', () => {
        registerRenderFont(url, 'preview-a')
        registerRenderFont(url, 'preview-b')

        expect(document.querySelectorAll('link[data-eceee-render-font]')).toHaveLength(1)
        unregisterRenderFont(url, 'preview-a')
        expect(document.querySelectorAll('link[data-eceee-render-font]')).toHaveLength(1)
        unregisterRenderFont(url, 'preview-b')
        expect(document.querySelectorAll('link[data-eceee-render-font]')).toHaveLength(0)
    })
})
