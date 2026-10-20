import { describe, expect, it, vi } from 'vitest'
import {
    ALWAYS_SHOW_EDITOR_CONTROLS_KEY,
    readAlwaysShowEditorControls,
    writeAlwaysShowEditorControls,
} from '../pageEditorPreferences'

describe('page editor control preferences', () => {
    it('shows controls by default when no preference has been stored', () => {
        const storage = { getItem: vi.fn(() => null) }

        expect(readAlwaysShowEditorControls(storage)).toBe(true)
        expect(storage.getItem).toHaveBeenCalledWith(ALWAYS_SHOW_EDITOR_CONTROLS_KEY)
    })

    it('restores hover-only mode from storage', () => {
        const storage = { getItem: vi.fn(() => 'false') }

        expect(readAlwaysShowEditorControls(storage)).toBe(false)
    })

    it('persists the selected mode', () => {
        const storage = { setItem: vi.fn() }

        writeAlwaysShowEditorControls(false, storage)

        expect(storage.setItem).toHaveBeenCalledWith(ALWAYS_SHOW_EDITOR_CONTROLS_KEY, 'false')
    })

    it('falls back to always visible when storage cannot be read', () => {
        const storage = { getItem: vi.fn(() => { throw new Error('blocked') }) }

        expect(readAlwaysShowEditorControls(storage)).toBe(true)
    })
})
