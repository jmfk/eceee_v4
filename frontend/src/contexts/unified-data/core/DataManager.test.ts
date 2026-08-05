import { describe, expect, it, vi } from 'vitest'
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

    it('honors explicit page and version targets for cross-page widget operations', () => {
        const pageB = createPage({
            id: 'page-2',
            title: 'Target Page',
            currentVersionId: 'version-2',
            availableVersions: ['version-2']
        })
        const versionB = createVersion({
            id: 'version-2',
            pageId: 'page-2',
            widgets: {
                main: [
                    createWidget({
                        id: 'widget-b',
                        config: { content: 'Page B original' }
                    })
                ]
            }
        })
        const manager = new DataManager(createAppState({
            pages: {
                'page-1': createPage(),
                'page-2': pageB
            },
            versions: {
                'version-1': createVersion({
                    widgets: {
                        main: [
                            createWidget({
                                id: 'widget-a',
                                config: { content: 'Page A original' }
                            })
                        ]
                    }
                }),
                'version-2': versionB
            },
            metadata: {
                currentPageId: 'page-1',
                currentVersionId: 'version-1'
            }
        }))

        manager.dispatch({
            type: OperationTypes.ADD_WIDGET,
            payload: {
                id: 'widget-b-pasted',
                type: 'content.TextWidget',
                slot: 'main',
                contextType: 'page',
                pageId: 'page-2',
                versionId: 'version-2',
                config: { content: 'Pasted into page B' },
                order: 1
            }
        })

        manager.dispatch({
            type: OperationTypes.REMOVE_WIDGET,
            payload: {
                id: 'widget-b',
                contextType: 'page',
                pageId: 'page-2',
                versionId: 'version-2'
            }
        })

        expect(manager.getState().versions['version-1'].widgets.main.map(widget => widget.id)).toEqual(['widget-a'])
        expect(manager.getState().versions['version-2'].widgets.main.map(widget => widget.id)).toEqual(['widget-b-pasted'])
    })
})

describe('DataManager subscriptions', () => {
    const flushQueuedCallbacks = () => new Promise(resolve => queueMicrotask(resolve))

    it('notifies subscribers for two synchronous updates in dispatch order', async () => {
        const manager = new DataManager(createAppState())
        const received: boolean[] = []

        manager.subscribe(
            state => state.metadata.isDirty,
            value => received.push(value)
        )

        manager.dispatch({
            type: OperationTypes.SET_DIRTY,
            payload: { isDirty: true }
        })
        manager.dispatch({
            type: OperationTypes.SET_DIRTY,
            payload: { isDirty: false }
        })

        await flushQueuedCallbacks()

        expect(received).toEqual([true, false])
    })

    it('passes the snapshot selected when the callback was queued, not later state', async () => {
        const manager = new DataManager(createAppState())
        const snapshots: Array<{ isDirty: boolean }> = []

        manager.subscribe(
            state => ({ isDirty: state.metadata.isDirty }),
            value => snapshots.push(value),
            { equalityFn: () => false }
        )

        manager.dispatch({
            type: OperationTypes.SET_DIRTY,
            payload: { isDirty: true }
        })
        manager.dispatch({
            type: OperationTypes.SET_DIRTY,
            payload: { isDirty: false }
        })

        await flushQueuedCallbacks()

        expect(snapshots).toEqual([{ isDirty: true }, { isDirty: false }])
    })

    it('does not fire queued callbacks after unsubscribe', async () => {
        const manager = new DataManager(createAppState())
        const callback = vi.fn()

        const unsubscribe = manager.subscribe(
            state => state.metadata.isDirty,
            callback
        )

        manager.dispatch({
            type: OperationTypes.SET_DIRTY,
            payload: { isDirty: true }
        })
        unsubscribe()

        await flushQueuedCallbacks()

        expect(callback).not.toHaveBeenCalled()
    })
})
