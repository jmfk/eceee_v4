import { describe, expect, it } from 'vitest'
import { safeReportLocation } from '../support'

describe('report location capture', () => {
    it('removes all query parameters and fragments from an automatically captured link', () => {
        expect(
            safeReportLocation(
                'https://cms.example.invalid/pages/42?token=private&tab=content#secret',
            ),
        ).toBe('https://cms.example.invalid/pages/42')
    })
    it('rejects executable URLs and leaves an absent location empty', () => {
        expect(safeReportLocation('javascript:alert(1)')).toBe('')
        expect(safeReportLocation('')).toBe('')
    })
})
