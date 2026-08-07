import { describe, expect, it } from 'vitest'
import { DataManager } from './DataManager'
import { OperationTypes } from '../types/operations'
import { createAppState, createPage, createVersion, createWidget } from '../../../test/unifiedDataTestUtils'

describe('DataManager state operations', () => {
    it('initializes page and version state without marking dirty', () => {
        const manager = new DataManager()
        const page = createPage()
        const version = createVersion()

        manager.dispatch({
            type: OperationTypes.INIT_PAGE,
            payload: { id: page.id, data: page }
        })

        manager.dispatch({
            type: OperationTypes.INIT_VERSION,
            payload: { id: version.id, data: version }
        })

        const state = manager.getState()
        expect(state.pages[page.id]).toMatchObject({ id: page.id, title: page.title })
        expect(state.versions[version.id]).toMatchObject({ id: version.id, pageId: page.id })
        expect(state.metadata.currentPageId).toBe(page.id)
        expect(state.metadata.currentVersionId).toBe(version.id)
        expect(state.metadata.isDirty).toBe(false)
    })

    it('updates top-level widget config and marks the page dirty', () => {
        const manager = new DataManager(createAppState())

        manager.dispatch({
            type: OperationTypes.UPDATE_WIDGET_CONFIG,
            payload: {
                id: 'widget-1',
                slotName: 'main',
                contextType: 'page',
                pageId: 'page-1',
                config: { content: 'Updated content' }
            }
        })

        const widget = manager.getState().versions['version-1'].widgets.main[0]
        expect(widget.config).toMatchObject({ content: 'Updated content' })
        expect(manager.getState().metadata.isDirty).toBe(true)
    })

    it('does not mark clean state dirty when a version update is flagged skipDirty', () => {
        const manager = new DataManager(createAppState())

        manager.dispatch({
            type: OperationTypes.UPDATE_PAGE_VERSION_DATA,
            payload: {
                id: 'version-1',
                updates: { metadata: { description: 'Server merged metadata' } },
                skipDirty: true
            }
        })

        expect(manager.getState().versions['version-1'].metadata).toMatchObject({
            description: 'Server merged metadata'
        })
        expect(manager.getState().metadata.isDirty).toBe(false)
    })

    it('switches versions, resets dirty state, and tracks last viewed version', () => {
        const secondVersion = createVersion({
            id: 'version-2',
            number: 2,
            versionNumber: 2,
            widgets: { main: [createWidget({ id: 'widget-2' })] }
        })
        const manager = new DataManager(createAppState({
            versions: {
                'version-1': createVersion(),
                'version-2': secondVersion
            },
            metadata: {
                isDirty: true
            }
        }))

        manager.dispatch({
            type: OperationTypes.SWITCH_VERSION,
            payload: {
                pageId: 'page-1',
                versionId: 'version-2'
            }
        })

        const state = manager.getState()
        expect(state.metadata.currentPageId).toBe('page-1')
        expect(state.metadata.currentVersionId).toBe('version-2')
        expect(state.metadata.isDirty).toBe(false)
        expect(state.metadata.lastViewedVersions).toMatchObject({ 'page-1': 'version-2' })
    })

    it('throws for invalid widget update payloads and leaves state unchanged', () => {
        const manager = new DataManager(createAppState())

        expect(() => manager.dispatch({
            type: OperationTypes.UPDATE_WIDGET_CONFIG,
            payload: {
                id: 'widget-1',
                contextType: 'page',
                pageId: 'page-1',
                config: { content: 'Should not apply' }
            }
        })).toThrow(/slotName/)

        const state = manager.getState()
        expect(state.versions['version-1'].widgets.main[0].config.content).toBe('Initial content')
        expect(state.metadata.isDirty).toBe(false)
    })

    it('updates nested widget config by widgetPath', () => {
        const manager = new DataManager(createAppState({
            versions: {
                'version-1': createVersion({
                    widgets: {
                        main: [
                            createWidget({
                                id: 'section-1',
                                type: 'layout.SectionWidget',
                                config: {
                                    slots: {
                                        content: [
                                            createWidget({
                                                id: 'headline-1',
                                                type: 'content.HeadlineWidget',
                                                config: { text: 'Original headline' }
                                            })
                                        ]
                                    }
                                }
                            })
                        ]
                    }
                })
            }
        }))

        manager.dispatch({
            type: OperationTypes.UPDATE_WIDGET_CONFIG,
            payload: {
                id: 'headline-1',
                slotName: 'content',
                contextType: 'page',
                pageId: 'page-1',
                widgetPath: ['main', 'section-1', 'content', 'headline-1'],
                config: { text: 'Nested headline updated' }
            }
        })

        const nestedWidget = manager
            .getState()
            .versions['version-1']
            .widgets
            .main[0]
            .config
            .slots
            .content[0]

        expect(nestedWidget.config.text).toBe('Nested headline updated')
        expect(manager.getState().metadata.isDirty).toBe(true)
    })
})
