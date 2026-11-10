import { describe, expect, it } from 'vitest'
import { howToSourceFingerprint } from '../../../scripts/howto-source.mjs'

describe('video preview source provenance', () => {
    const guide = { id: 'demo', helpGuideId: 'pages-create', title: 'Demo', actions: [{ type: 'click', role: 'button', name: 'Save', captionSv: 'Spara.' }] }
    it('rejects footage made with a different action even if narration is unchanged', () => {
        const changed = { ...guide, actions: [{ ...guide.actions[0], name: 'Publish' }] }
        expect(howToSourceFingerprint(changed, 'sv')).not.toBe(howToSourceFingerprint(guide, 'sv'))
    })
    it('is portable across recording paths and distinguishes help identity and locale', () => {
        expect(howToSourceFingerprint({ ...guide, sourcePath: '/another/machine/manus.md' }, 'sv')).toBe(howToSourceFingerprint(guide, 'sv'))
        expect(howToSourceFingerprint({ ...guide, helpGuideId: 'objects-manage' }, 'sv')).not.toBe(howToSourceFingerprint(guide, 'sv'))
        expect(howToSourceFingerprint(guide, 'en')).not.toBe(howToSourceFingerprint(guide, 'sv'))
    })
})
