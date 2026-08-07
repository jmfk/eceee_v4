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
 *   2. PageEditor mirrors field-buffer UDC edits into its dirty snapshot
 */

import { describe, it, expect } from 'vitest'
import { analyzeChanges } from '../../utils/smartSaveUtils'
import { applyWidgetUpdateToWidgetMap } from '../../utils/pageEditorWidgetState'

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

    it('returns hasPageChanges=true when the path pattern changes', () => {
        const originalWebpage = { ...baseWebpage, pathPatternKey: '' }
        const editedWebpage = { ...baseWebpage, pathPatternKey: 'news_slug' }

        const result = analyzeChanges(originalWebpage, editedWebpage, baseVersion, baseVersion)

        expect(result.hasPageChanges).toBe(true)
        expect(result.pageFields.pathPatternKey).toBe('news_slug')
        expect(result.changedFieldNames).toContain('pathPatternKey')
    })

    it('returns hasVersionChanges=true when page tags change', () => {
        const originalVersion = { ...baseVersion, tags: ['energy'] }
        const editedVersion = { ...baseVersion, tags: ['energy', 'policy'] }

        const result = analyzeChanges(baseWebpage, baseWebpage, originalVersion, editedVersion)

        expect(result.hasVersionChanges).toBe(true)
        expect(result.versionFields.tags).toEqual(['energy', 'policy'])
        expect(result.changedFieldNames).toContain('tags')
    })
})

// ---------------------------------------------------------------------------
// 2. PageEditor UDC source handling — regression guard
//
// We test the filter logic directly as a pure function so we don't need to
// mount the full component. The filter is extracted inline for testability.
// ---------------------------------------------------------------------------

/**
 * Mirrors the field-buffer source detection in PageEditor.useExternalChanges.
 * These sources should sync the canonical UDC version snapshot before returning
 * so save can activate for isolated form fields and special editors.
 */
function shouldSyncVersionBeforeReturning(sourceId) {
    return (
        sourceId.startsWith('isolated-form-') ||
        sourceId.startsWith('special-editor-') ||
        sourceId.startsWith('field-') ||
        sourceId.includes('-field-')
    )
}

describe('PageEditor UDC source handling', () => {
    it('syncs isolated-form- sources (WidgetEditorPanel form buffer)', () => {
        expect(shouldSyncVersionBeforeReturning('isolated-form-widget-abc123')).toBe(true)
    })

    it('syncs special-editor- sources', () => {
        expect(shouldSyncVersionBeforeReturning('special-editor-table-1')).toBe(true)
    })

    it('syncs field- sources', () => {
        expect(shouldSyncVersionBeforeReturning('field-title')).toBe(true)
    })

    it('syncs -field- sources (bannerwidget-*-field-* pattern)', () => {
        expect(shouldSyncVersionBeforeReturning('bannerwidget-123-field-imageUrl')).toBe(true)
    })

    it('continues normal handling for widget- sources (inline ContentWidget, BannerWidget etc.)', () => {
        expect(shouldSyncVersionBeforeReturning('widget-abc123')).toBe(false)
    })

    it('continues normal handling for bannerwidget- sources for widget CRUD ops', () => {
        expect(shouldSyncVersionBeforeReturning('bannerwidget-abc123')).toBe(false)
    })

    it('continues normal handling for page-editor- sources', () => {
        expect(shouldSyncVersionBeforeReturning('page-editor-1-10')).toBe(false)
    })

    it('continues normal handling for section-widget- sources', () => {
        expect(shouldSyncVersionBeforeReturning('section-widget-abc')).toBe(false)
    })

    it('continues normal handling for contentcardwidget- sources', () => {
        expect(shouldSyncVersionBeforeReturning('contentcardwidget-abc')).toBe(false)
    })
})

describe('PageEditor widget state convergence', () => {
    it('applies panel-shaped and inline-shaped widget edits to the same canonical widget state', () => {
        const widgets = {
            main: [
                { id: 'content-intro', type: 'easy_widgets.ContentWidget', config: { content: '<p>Initial</p>', isActive: true } },
                { id: 'content-sidebar', type: 'easy_widgets.ContentWidget', config: { content: '<p>Sidebar</p>', isActive: true } }
            ]
        }

        const panelUpdatedWidgets = applyWidgetUpdateToWidgetMap(widgets, {
            id: 'content-intro',
            type: 'easy_widgets.ContentWidget',
            slotName: 'main',
            context: { slotName: 'main' },
            config: { content: '<p>Edited from panel</p>' }
        })

        const inlineUpdatedWidgets = applyWidgetUpdateToWidgetMap(widgets, {
            id: 'content-intro',
            type: 'easy_widgets.ContentWidget',
            slot: 'main',
            config: { content: '<p>Edited from panel</p>' }
        })

        expect(panelUpdatedWidgets).toEqual(inlineUpdatedWidgets)
        expect(panelUpdatedWidgets.main[0].config).toEqual({
            content: '<p>Edited from panel</p>',
            isActive: true
        })
        expect(panelUpdatedWidgets.main[1]).toBe(widgets.main[1])
    })

    it('applies panel widget metadata without storing the transport wrapper', () => {
        const widgets = {
            main: [
                { id: 'content-intro', type: 'easy_widgets.ContentWidget', config: { content: '<p>Initial</p>' } }
            ]
        }

        const updatedWidgets = applyWidgetUpdateToWidgetMap(widgets, {
            id: 'content-intro',
            slotName: 'main',
            config: { content: '<p>Panel edit</p>' },
            widgetUpdates: { activeVariants: ['rich'] }
        })

        expect(updatedWidgets.main[0].activeVariants).toEqual(['rich'])
        expect(updatedWidgets.main[0]).not.toHaveProperty('widgetUpdates')
    })

    it('does not store widgetPath routing metadata in canonical widget state', () => {
        const widgets = {
            main: [
                { id: 'content-intro', type: 'easy_widgets.ContentWidget', config: { content: '<p>Initial</p>' } }
            ]
        }

        const updatedWidgets = applyWidgetUpdateToWidgetMap(widgets, {
            id: 'content-intro',
            slotName: 'main',
            widgetPath: ['main', 'content-intro'],
            config: { content: '<p>Panel edit</p>' }
        })

        expect(updatedWidgets.main[0].config.content).toBe('<p>Panel edit</p>')
        expect(updatedWidgets.main[0]).not.toHaveProperty('widgetPath')
    })

    it('applies nested widget prop edits without stale sibling overwrites', () => {
        const widgets = {
            main: [
                {
                    id: 'container-1',
                    type: 'easy_widgets.TwoColumnsWidget',
                    config: {
                        title: 'Container',
                        slots: {
                            left: [
                                {
                                    id: 'nested-content',
                                    type: 'easy_widgets.ContentWidget',
                                    config: { content: '<p>Nested initial</p>', isActive: true }
                                },
                                {
                                    id: 'nested-sibling',
                                    type: 'easy_widgets.ContentWidget',
                                    config: { content: '<p>Sibling stays put</p>', isActive: true }
                                }
                            ]
                        }
                    }
                },
                {
                    id: 'headline-main',
                    type: 'easy_widgets.HeadlineWidget',
                    config: { content: 'Sibling headline' }
                }
            ]
        }

        const updatedWidgets = applyWidgetUpdateToWidgetMap(widgets, {
            id: 'nested-content',
            slotName: 'left',
            widgetPath: ['main', 'container-1', 'left', 'nested-content'],
            config: { content: '<p>Nested final</p>' }
        })

        expect(updatedWidgets.main[0].config.slots.left[0].config).toEqual({
            content: '<p>Nested final</p>',
            isActive: true
        })
        expect(updatedWidgets.main[0].config.slots.left[1]).toBe(widgets.main[0].config.slots.left[1])
        expect(updatedWidgets.main[1]).toBe(widgets.main[1])
    })

    it('preserves final canonical save payload after rapid mixed inline, panel, and nested edits', () => {
        const initialWidgets = {
            main: [
                {
                    id: 'content-intro',
                    type: 'easy_widgets.ContentWidget',
                    config: { content: '<p>Initial</p>', isActive: true }
                },
                {
                    id: 'container-1',
                    type: 'easy_widgets.TwoColumnsWidget',
                    config: {
                        slots: {
                            left: [
                                {
                                    id: 'nested-content',
                                    type: 'easy_widgets.ContentWidget',
                                    config: { content: '<p>Nested initial</p>', isActive: true }
                                }
                            ]
                        }
                    }
                }
            ]
        }

        const afterInline = applyWidgetUpdateToWidgetMap(initialWidgets, {
            id: 'content-intro',
            slotName: 'main',
            config: { content: '<p>Inline draft</p>' }
        })
        const afterPanel = applyWidgetUpdateToWidgetMap(afterInline, {
            id: 'content-intro',
            slotName: 'main',
            config: { content: '<p>Panel final</p>' }
        })
        const finalWidgets = applyWidgetUpdateToWidgetMap(afterPanel, {
            id: 'nested-content',
            slotName: 'left',
            context: { widgetPath: ['main', 'container-1', 'left', 'nested-content'] },
            config: { content: '<p>Nested final</p>' }
        })

        const savePayload = { widgets: finalWidgets }

        expect(savePayload.widgets.main[0].config).toEqual({
            content: '<p>Panel final</p>',
            isActive: true
        })
        expect(savePayload.widgets.main[1].config.slots.left[0].config).toEqual({
            content: '<p>Nested final</p>',
            isActive: true
        })
        expect(savePayload.widgets.main).toHaveLength(2)
    })
})
