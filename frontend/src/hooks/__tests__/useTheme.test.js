import { describe, expect, it } from 'vitest'
import { supportsCSSScope } from '../useTheme'

describe('editor theme CSS helpers', () => {
    it('reports unsupported CSS scope without throwing', () => {
        expect(typeof supportsCSSScope()).toBe('boolean')
    })
})
