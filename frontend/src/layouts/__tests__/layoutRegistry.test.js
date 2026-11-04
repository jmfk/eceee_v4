import { describe, expect, it } from 'vitest'

import { getLayoutComponent, getLayoutMetadata, layoutExists } from '..'

describe('layout registry legacy aliases', () => {
    it('resolves stored snake_case layout names to the canonical components', () => {
        for (const [legacy, canonical] of [['main_layout', 'mainLayout'], ['landing_page', 'landingPage']]) {
            expect(getLayoutComponent(legacy)).toBe(getLayoutComponent(canonical))
            expect(getLayoutMetadata(legacy)).toBe(getLayoutMetadata(canonical))
            expect(layoutExists(legacy)).toBe(true)
        }
    })
})
