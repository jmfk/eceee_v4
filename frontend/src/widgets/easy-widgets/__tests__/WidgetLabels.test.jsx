import { describe, expect, it } from 'vitest'

import TableWidget from '../TableWidget'
import ThreeColumnsWidget from '../ThreeColumnsWidget'
import TwoColumnsWidget from '../TwoColumnsWidget'

describe('public widget labels', () => {
    it.each([
        [TableWidget, 'Table'],
        [TwoColumnsWidget, 'Two Columns'],
        [ThreeColumnsWidget, 'Three Columns'],
    ])('uses a product-neutral label', (Widget, expectedLabel) => {
        expect(Widget.displayName).toBe(expectedLabel)
        expect(Widget.displayName).not.toMatch(/eceee/i)
    })
})
