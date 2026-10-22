import { describe, it, expect } from 'vitest'
import { analyzeChanges, buildWorkingCopyPayload, processLoadedVersionData } from '../../utils/smartSaveUtils'

describe('classification version persistence', () => {
    it('sends ordered classification IDs in the complete working-copy payload', () => {
        const loaded = processLoadedVersionData({ id: 'version', classification_ids: ['b', 'a'] })
        expect(loaded.classification_ids).toBeUndefined()
        expect(buildWorkingCopyPayload(loaded).classificationIds).toEqual(['b', 'a'])
    })
    it('detects classification changes, including clear and reorder, without reference-only dirtiness', () => {
        const original = { classificationIds: ['a', 'b'] }
        expect(analyzeChanges({}, {}, original, { classificationIds: ['a', 'b'] }).hasVersionChanges).toBe(false)
        expect(analyzeChanges({}, {}, original, { classificationIds: [] }).hasVersionChanges).toBe(true)
        expect(analyzeChanges({}, {}, original, { classificationIds: ['b', 'a'] }).hasVersionChanges).toBe(true)
    })
})
