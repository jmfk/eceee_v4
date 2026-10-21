import { describe, expect, it } from 'vitest'
import { textOutlineCss, textOutlineShadow } from '../textOutlineStyles'
import { getBannerPresentationStyle } from '../bannerConfig'
import { compileRenderStyles } from '../../rendering/themeCssCompiler'

describe('theme text outline styles', () => {
    it('compiles all effect and color modes', () => {
        for (const style of ['outline', 'gradientBlur', 'dropShadow']) {
            for (const colorMode of ['same', 'white', 'black', 'complement', 'rgb']) {
                expect(textOutlineShadow({ style, colorMode })).not.toBe('none')
            }
        }
        expect(textOutlineShadow({ style: 'dropShadow', angle: 90, offset: 3, thickness: 0, radius: 5 })).toBe('0px 3px 5px #000000')
        expect(textOutlineShadow({ colorMode: 'complement' })).toContain('calc(255 - r)')
    })
    it('compiles named effects for camel and snake theme payloads', () => {
        for (const field of ['textOutlineStyles', 'text_outline_styles']) {
            const theme = { [field]: { softGlow: { style: 'gradientBlur', radius: 8 } } }
            expect(compileRenderStyles({ theme }).css).toContain('--text-outline-softGlow:')
            expect(getBannerPresentationStyle({ textOutline: 'softGlow' }, theme)['--banner-text-shadow']).toContain('8px')
        }
        expect(getBannerPresentationStyle({ text_outline: 'softGlow' })['--banner-text-shadow']).toBe('var(--text-outline-softGlow, none)')
    })
    it('rejects unsafe keys, malformed values and missing selections safely', () => {
        expect(textOutlineCss({ 'x; color:red': {}, fine: { radius: -1 } })).not.toContain('color:red')
        for (const key of ['__proto__', 'constructor', 'x; color:red']) expect(getBannerPresentationStyle({ textOutline: key })['--banner-text-shadow']).toBe('none')
        expect(textOutlineShadow({ radius: Infinity })).toBe('none')
        expect(textOutlineShadow({ colorMode: '__proto__' })).toBe('none')
    })
})

describe('theme-owned default outlines', () => {
    it('uses edited dark and light definitions instead of hard-coded banner shadows', () => {
        for (const key of ['dark', 'light']) {
            const theme = { textOutlineStyles: { [key]: { colorMode: 'rgb', color: '#123456', thickness: 3 } } }
            expect(getBannerPresentationStyle({ textOutline: key }, theme)['--banner-text-shadow']).toContain('#123456')
            expect(compileRenderStyles({ theme }).css).toContain(`--text-outline-${key}:`)
            expect(getBannerPresentationStyle({ textOutline: key })['--banner-text-shadow']).toBe(`var(--text-outline-${key}, none)`)
        }
        expect(getBannerPresentationStyle({ textOutline: 'none' }, { textOutlineStyles: {} })['--banner-text-shadow']).toBe('none')
    })
})
