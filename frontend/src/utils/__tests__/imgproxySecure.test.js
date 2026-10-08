import { describe, expect, it, vi } from 'vitest'

import { getImgproxyUrl } from '../imgproxySecure'


describe('getImgproxyUrl', () => {
    it('keeps self-contained image data URLs out of the signing service', async () => {
        const source = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E'
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        await expect(getImgproxyUrl(source, { width: 480 })).resolves.toBe(source)
        expect(fetchSpy).not.toHaveBeenCalled()

        fetchSpy.mockRestore()
    })
})
