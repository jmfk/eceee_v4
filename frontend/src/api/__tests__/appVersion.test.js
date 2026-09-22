import { describe, expect, it } from 'vitest'

import { shouldReloadForAppVersion } from '../appVersion.js'

describe('application version reload guard', () => {
    it('reloads when the server and loaded frontend builds differ', () => {
        expect(shouldReloadForAppVersion('build-b', 'build-a')).toBe(true)
    })

    it('does not reload when the builds match', () => {
        expect(shouldReloadForAppVersion('build-a', 'build-a')).toBe(false)
    })

    it('does not loop after already reloading for the server build', () => {
        expect(shouldReloadForAppVersion('build-b', 'build-a', 'build-b')).toBe(false)
    })

    it('ignores unavailable development build identifiers', () => {
        expect(shouldReloadForAppVersion('', 'build-a')).toBe(false)
        expect(shouldReloadForAppVersion('unknown', 'build-a')).toBe(false)
    })
})
