import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authRequest, clearLegacyTokens, safeDestination, webAuthnCredential } from '../auth'

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks() })

describe('browser authentication adapter', () => {
    it('fetches a fresh CSRF token and preserves allauth field casing', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'masked-test-csrf' }) })
            .mockResolvedValueOnce({ status: 200, json: async () => ({ meta: { is_authenticated: true } }) })
        const result = await authRequest('/auth/login', { method: 'POST', data: { username: 'editor', password: 'synthetic-password' } })
        expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin', headers: { 'X-CSRFToken': 'masked-test-csrf' } })
        expect(result.meta.is_authenticated).toBe(true)
        expect(fetch.mock.calls[1][1].headers.Authorization).toBeUndefined()
    })

    it('clears legacy personal tokens while retaining workspace selection', () => {
        localStorage.setItem('access_token', 'obsolete')
        localStorage.setItem('refresh_token', 'obsolete')
        localStorage.setItem('workspace', 'tenant-a')
        clearLegacyTokens()
        expect(localStorage.getItem('access_token')).toBeNull()
        expect(localStorage.getItem('refresh_token')).toBeNull()
        expect(localStorage.getItem('workspace')).toBe('tenant-a')
    })

    it('rejects external and ambiguous return destinations', () => {
        for (const value of ['https://attacker.invalid', '//attacker.invalid', '/\\attacker.invalid', '/login?next=bad']) expect(safeDestination(value)).toBe('/')
        expect(safeDestination('/inbox?tenant=target#reply')).toBe('/inbox?tenant=target#reply')
    })

    it('provides a recoverable message if WebAuthn is unavailable', async () => {
        await expect(webAuthnCredential({})).rejects.toThrow('does not support passkeys')
    })
})
