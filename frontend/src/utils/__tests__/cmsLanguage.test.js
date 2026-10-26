import { describe, expect, it } from 'vitest'
import { helpLanguageFor, resolveCmsLanguage } from '../cmsLanguage'
import { cmsLegacyText, cmsText, cmsTextGlobal, setCmsCopyLanguage } from '../cmsCopy'

describe('CMS language resolution', () => {
    it('uses the first browser language and falls back to English', () => {
        expect(resolveCmsLanguage('', ['sv-SE', 'en-US'])).toBe('sv-se')
        expect(resolveCmsLanguage('', ['fr-FR', 'sv-SE'])).toBe('en-us')
        expect(resolveCmsLanguage('', [])).toBe('en-us')
    })

    it('lets the account preference override the browser for CMS and help', () => {
        expect(resolveCmsLanguage('en-us', ['sv-SE'])).toBe('en-us')
        expect(resolveCmsLanguage('sv-se', ['en-US'])).toBe('sv-se')
        expect(helpLanguageFor('sv-se')).toBe('sv')
        expect(helpLanguageFor('en-us')).toBe('en')
    })

    it('keeps critical actions unambiguous in Swedish', () => {
        expect(cmsText('Delete', 'sv-se')).toBe('Ta bort')
        expect(cmsText('Cancel', 'sv-se')).toBe('Avbryt')
        setCmsCopyLanguage('sv-se')
        expect(cmsTextGlobal(' Save draft ')).toBe(' Spara utkast ')
        setCmsCopyLanguage('en-us')
    })

    it('shows older Swedish-only labels in English by default', () => {
        expect(cmsLegacyText('Behörigheter', 'en-us')).toBe('Permissions')
        expect(cmsLegacyText('Behörigheter', 'sv-se')).toBe('Behörigheter')
        setCmsCopyLanguage('en-us')
        expect(cmsTextGlobal('Behörigheter')).toBe('Permissions')
    })
})
