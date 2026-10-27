import { describe, expect, it } from 'vitest'
import { datePresets } from '../objectDatePresets'

describe('object date presets', () => {
    it('uses local calendar days and Monday-based weeks across month boundaries', () => {
        const presets = datePresets(new Date(2026, 2, 1, 15, 30))
        expect(presets.find(item => item.label === 'Today').values).toEqual(['2026-03-01', '2026-03-01'])
        expect(presets.find(item => item.label === 'Yesterday').values).toEqual(['2026-02-28', '2026-02-28'])
        expect(presets.find(item => item.label === 'Previous week').values).toEqual(['2026-02-16', '2026-02-22'])
        expect(presets.find(item => item.label === 'Previous month').values).toEqual(['2026-02-01', '2026-02-28'])
        expect(presets.find(item => item.label === 'Last 7 days').values).toEqual(['2026-02-23', '2026-03-01'])
        expect(datePresets(new Date(2026, 2, 31)).find(item => item.label === 'Last month').values).toEqual(['2026-02-28', '2026-03-31'])
    })
})
