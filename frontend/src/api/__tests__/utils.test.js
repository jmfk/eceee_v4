import { describe, expect, it } from 'vitest'

import { processResponse, wrapApiCall } from '../utils.js'

describe('api utils', () => {
    describe('processResponse', () => {
        it('preserves null and undefined direct results', () => {
            expect(processResponse(null)).toBeNull()
            expect(processResponse(undefined)).toBeUndefined()
        })

        it('returns axios data even when the payload is empty', () => {
            expect(processResponse({ data: null })).toBeNull()
            expect(processResponse({ data: false })).toBe(false)
            expect(processResponse({ data: 0 })).toBe(0)
        })

        it('returns direct data for non-axios responses', () => {
            const result = { slug: 'default' }

            expect(processResponse(result)).toBe(result)
        })
    })

    describe('wrapApiCall', () => {
        it('allows wrapped api calls to return null as a valid result', async () => {
            const apiCall = wrapApiCall(async () => null, 'namespaces.getDefault')

            await expect(apiCall()).resolves.toBeNull()
        })
    })
})
