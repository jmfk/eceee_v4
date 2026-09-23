import { describe, expect, it, vi } from 'vitest'

import {
    APP_VERSION_RELOAD_RETRY_MS,
    APP_VERSION_MISMATCH_EVENT,
    shouldReloadForAppVersion,
} from '../appVersion.js'

describe('application version reload guard', () => {
    it('reloads when the server and loaded frontend builds differ', () => {
        expect(shouldReloadForAppVersion('build-b', 'build-a')).toBe(true)
    })

    it('does not reload when the builds match', () => {
        expect(shouldReloadForAppVersion('build-a', 'build-a')).toBe(false)
    })

    it('does not loop after already reloading for the server build', () => {
        expect(shouldReloadForAppVersion(
            'build-b',
            'build-a',
            { version: 'build-b', attemptedAt: 1_000 },
            1_000 + APP_VERSION_RELOAD_RETRY_MS - 1,
        )).toBe(false)
    })

    it('allows another reload after the deployment retry window', () => {
        expect(shouldReloadForAppVersion(
            'build-b',
            'build-a',
            { version: 'build-b', attemptedAt: 1_000 },
            1_000 + APP_VERSION_RELOAD_RETRY_MS,
        )).toBe(true)
    })

    it('ignores unavailable development build identifiers', () => {
        expect(shouldReloadForAppVersion('', 'build-a')).toBe(false)
        expect(shouldReloadForAppVersion('unknown', 'build-a')).toBe(false)
    })

    it('allows a dirty editor to cancel a deployment reload', () => {
        const preventReload = vi.fn(event => event.preventDefault())
        window.addEventListener(APP_VERSION_MISMATCH_EVENT, preventReload)

        const allowed = window.dispatchEvent(new CustomEvent(
            APP_VERSION_MISMATCH_EVENT,
            { cancelable: true, detail: { serverVersion: 'build-b' } },
        ))

        expect(allowed).toBe(false)
        expect(preventReload).toHaveBeenCalledOnce()
        window.removeEventListener(APP_VERSION_MISMATCH_EVENT, preventReload)
    })
})
