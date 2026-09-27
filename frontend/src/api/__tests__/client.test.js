import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockAxiosInstance } from '../../test/setup'
import '../client'

describe('API client session handling', () => {
    afterEach(() => {
        localStorage.clear()
    })

    it('rejects standalone preview 401 responses instead of waiting for AuthProvider', async () => {
        const sessionExpired = vi.fn()
        window.addEventListener('session-expired', sessionExpired)

        const rejectResponse = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
        const error = {
            config: { skipSessionQueue: true },
            response: { status: 401, data: { detail: 'Authentication required.' } },
        }

        await expect(rejectResponse(error)).rejects.toBe(error)
        expect(sessionExpired).not.toHaveBeenCalled()
        window.removeEventListener('session-expired', sessionExpired)
    })
})
