import { describe, expect, it } from 'vitest'
import { howToDocs } from './howToDocs'
import { localizeGuide, localizeSection } from '../utils/howToI18n'

describe('localized help guides', () => {
    it('shows the bug report guide in English by default and Swedish when selected', () => {
        const section = howToDocs.find(item => item.id === 'support')
        const guide = section.guides.find(item => item.id === 'record-bug-video')

        expect(localizeSection(section, 'en').title).toBe('Inbox and support')
        expect(localizeGuide(guide, 'en').title).toBe('Record a five-second bug report')
        expect(localizeGuide(guide, 'en').steps[0]).toMatch(/^Open the page/)
        expect(localizeSection(section, 'sv').title).toBe('Inbox och support')
        expect(localizeGuide(guide, 'sv').title).toBe('Spela in en femsekunders buggrapport')
        expect(localizeGuide(guide, 'sv').steps[0]).toMatch(/^Öppna sidan/)
    })
})
