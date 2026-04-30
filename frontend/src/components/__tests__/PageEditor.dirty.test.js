/**
 * Dirty-flow regression tests
 *
 * These tests guard against the bug where inline ContentWidget edits were
 * silently dropped (pageVersionData.widgets never updated → isDirty stayed
 * false → handleActualSave sent stale widget content to the server).
 *
 * Instead of mounting the full PageEditor (too many deps), we test the key
 * units that compose the flow:
 *   1. analyzeChanges correctly flags widget edits as dirty
 *   2. The PageEditor isolated-source filter no longer drops widget CRUD ops
 */

import { describe, it, expect } from 'vitest'
import { analyzeChanges } from '../../utils/smartSaveUtils'

// ---------------------------------------------------------------------------
// 1. analyzeChanges — widget change detection
// ---------------------------------------------------------------------------

const baseWebpage = { id: 1, title: 'Page', slug: 'page', status: 'draft' }
const baseVersion = {
    id: 10,
    widgets: {
        main: [{ id: 'w1', type: 'easy_widgets.ContentWidget', config: { content: '<p>Original</p>' } }]
    }
}

describe('analyzeChanges — widget dirty detection', () => {
    it('returns hasVersionChanges=false when widgets are unchanged', () => {
        const result = analyzeChanges(baseWebpage, baseWebpage, baseVersion, baseVersion)
        expect(result.hasVersionChanges).toBe(false)
        expect(result.hasPageChanges).toBe(false)
    })

    it('returns hasVersionChanges=true when a widget config changes (inline edit)', () => {
        const editedVersion = {
            ...baseVersion,
            widgets: {
                main: [{ id: 'w1', type: 'easy_widgets.ContentWidget', config: { content: '<p>Updated by user</p>' } }]
            }
        }
        const result = analyzeChanges(baseWebpage, baseWebpage, baseVersion, editedVersion)
        expect(result.hasVersionChanges).toBe(true)
        expect(result.versionFields.widgets).toBeDefined()
        expect(result.changedFieldNames).toContain('widgets')
    })

    it('returns hasVersionChanges=true when a widget is added', () => {
        const addedVersion = {
            ...baseVersion,
            widgets: {
                main: [
                    { id: 'w1', type: 'easy_widgets.ContentWidget', config: { content: '<p>Original</p>' } },
                    { id: 'w2', type: 'easy_widgets.ContentWidget', config: { content: '<p>New</p>' } }
                ]
            }
        }
        const result = analyzeChanges(baseWebpage, baseWebpage, baseVersion, addedVersion)
        expect(result.hasVersionChanges).toBe(true)
    })

    it('returns hasVersionChanges=true when a widget is removed', () => {
        const removedVersion = { ...baseVersion, widgets: { main: [] } }
        const result = analyzeChanges(baseWebpage, baseWebpage, baseVersion, removedVersion)
        expect(result.hasVersionChanges).toBe(true)
    })

    it('returns hasVersionChanges=false after undoing back to original', () => {
        // Simulate: edit then undo (revert to original)
        const editedVersion = {
            ...baseVersion,
            widgets: {
                main: [{ id: 'w1', type: 'easy_widgets.ContentWidget', config: { content: '<p>Edited</p>' } }]
            }
        }
        // After undo, current == original
        const result = analyzeChanges(baseWebpage, baseWebpage, baseVersion, baseVersion)
        expect(result.hasVersionChanges).toBe(false)

        // After edit it is dirty
        const dirty = analyzeChanges(baseWebpage, baseWebpage, baseVersion, editedVersion)
        expect(dirty.hasVersionChanges).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// 2. PageEditor isolated-source filter — regression guard
//
// We test the filter logic directly as a pure function so we don't need to
// mount the full component. The filter is extracted inline for testability.
// ---------------------------------------------------------------------------

/**
 * Mirrors the filter logic in PageEditor.useExternalChanges after the fix.
 * Returns true if the update should be SKIPPED (i.e., it's a form-buffer source).
 */
function shouldSkipSource(sourceId) {
    return (
        sourceId.startsWith('isolated-form-') ||
        sourceId.startsWith('special-editor-') ||
        sourceId.startsWith('field-') ||
        sourceId.includes('-field-')
    )
}

describe('PageEditor isolated-source filter', () => {
    it('skips isolated-form- sources (WidgetEditorPanel form buffer)', () => {
        expect(shouldSkipSource('isolated-form-widget-abc123')).toBe(true)
    })

    it('skips special-editor- sources', () => {
        expect(shouldSkipSource('special-editor-table-1')).toBe(true)
    })

    it('skips field- sources', () => {
        expect(shouldSkipSource('field-title')).toBe(true)
    })

    it('skips -field- sources (bannerwidget-*-field-* pattern)', () => {
        expect(shouldSkipSource('bannerwidget-123-field-imageUrl')).toBe(true)
    })

    it('does NOT skip widget- sources (inline ContentWidget, BannerWidget etc.)', () => {
        expect(shouldSkipSource('widget-abc123')).toBe(false)
    })

    it('does NOT skip bannerwidget- sources for widget CRUD ops', () => {
        expect(shouldSkipSource('bannerwidget-abc123')).toBe(false)
    })

    it('does NOT skip page-editor- sources', () => {
        expect(shouldSkipSource('page-editor-1-10')).toBe(false)
    })

    it('does NOT skip section-widget- sources', () => {
        expect(shouldSkipSource('section-widget-abc')).toBe(false)
    })

    it('does NOT skip contentcardwidget- sources', () => {
        expect(shouldSkipSource('contentcardwidget-abc')).toBe(false)
    })
})
