import { afterEach, describe, expect, it } from 'vitest'
import { ThemeCSSManager } from '../themeCSSManager'

describe('ThemeCSSManager', () => {
    afterEach(() => {
        document.head.querySelectorAll('style[data-theme-styles="true"]').forEach(element => element.remove())
    })

    it('supports version keys and refreshes an injected stylesheet', () => {
        const manager = new ThemeCSSManager()

        manager.register('version-83', '.one h1 { color: red; }', '.eceee-theme-scope', 'editor')
        manager.register('version-83', '.one h1 { color: blue; }', '.eceee-theme-scope', 'editor-refresh')

        const style = document.getElementById('theme-content-version-83')
        expect(style).not.toBeNull()
        expect(style.textContent).toContain('color: blue')
        expect(style.dataset.scope).toBe('.eceee-theme-scope')

        manager.unregister('version-83', 'editor')
        expect(style.isConnected).toBe(true)
        manager.unregister('version-83', 'editor-refresh')
        expect(style.isConnected).toBe(false)
    })
})
