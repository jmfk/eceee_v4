/**
 * Widget System Abstraction Layer Tests
 * 
 * Tests to ensure the abstraction layer works correctly and provides
 * seamless widget operation across page and object contexts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    WidgetHost,
    PageWidgetContext,
    ObjectWidgetContext,
    TemplateSlot,
    ConfiguredSlot,
    ConfigurationManager,
    DataFlowManager,
    ApiClient,
    createWidgetContext,
    detectContextFromProps,
    validateContextTransition,
    SUPPORTED_CONTEXTS
} from '../index'

describe('Widget System Abstraction Layer', () => {
    describe('Context Detection', () => {
        it('should detect page context from props', () => {
            const pageProps = {
                layoutJson: { slots: {} },
                pageVersionData: { widgets: {} },
                webpageData: { id: 1 }
            }

            const context = detectContextFromProps(pageProps)
            expect(context).toBe(SUPPORTED_CONTEXTS.PAGE)
        })

        it('should detect object context from props', () => {
            const objectProps = {
                objectType: { id: 1, slotConfiguration: { slots: [] } },
                objectInstance: { id: 1 },
                objectWidgets: {}
            }

            const context = detectContextFromProps(objectProps)
            expect(context).toBe(SUPPORTED_CONTEXTS.OBJECT)
        })

        it('should default to page context when unclear', () => {
            const ambiguousProps = {}

            const context = detectContextFromProps(ambiguousProps)
            expect(context).toBe(SUPPORTED_CONTEXTS.PAGE)
        })
    })

    describe('Page Widget Context', () => {
        let pageContext
        let mockLayoutJson
        let mockPageVersionData
        let mockWebpageData

        beforeEach(() => {
            mockLayoutJson = {
                slots: {
                    'main-content': {
                        label: 'Main Content',
                        allowedTypes: null,
                        maxWidgets: null
                    },
                    'sidebar': {
                        label: 'Sidebar',
                        allowedTypes: ['text-block', 'image'],
                        maxWidgets: 3
                    }
                }
            }

            mockPageVersionData = {
                id: 1,
                widgets: {
                    'main-content': [
                        {
                            id: 'widget-1',
                            type: 'text-block',
                            config: { content: 'Hello World' },
                            inherited: false
                        }
                    ]
                }
            }

            mockWebpageData = {
                id: 1,
                title: 'Test Page'
            }

            pageContext = new PageWidgetContext({
                layoutJson: mockLayoutJson,
                pageVersionData: mockPageVersionData,
                webpageData: mockWebpageData,
                editable: true
            })
        })

        it('should initialize with correct context type', () => {
            expect(pageContext.type).toBe(SUPPORTED_CONTEXTS.PAGE)
        })

        it('should return correct slots', () => {
            const slots = pageContext.getSlots()
            expect(slots).toHaveLength(2)

            const mainSlot = slots.find(s => s.id === 'main-content')
            expect(mainSlot).toBeDefined()
            expect(mainSlot.label).toBe('Main Content')
            expect(mainSlot.accepts).toBeNull() // Accepts all types
        })

        it('should return widgets for a slot', () => {
            const widgets = pageContext.getWidgets('main-content')
            expect(widgets).toHaveLength(1)
            expect(widgets[0].id).toBe('widget-1')
        })

        it('should add widget to slot', async () => {
            const newWidget = {
                id: 'widget-2',
                type: 'image',
                config: { src: 'test.jpg' }
            }

            const result = await pageContext.addWidget('sidebar', newWidget)
            expect(result.success).toBe(true)

            const widgets = pageContext.getWidgets('sidebar')
            expect(widgets).toHaveLength(1)
            expect(widgets[0].id).toBe('widget-2')
        })

        it('should validate widget types for slots', () => {
            // Main content accepts all types
            expect(pageContext.canAddWidget('main-content', 'text-block')).toBe(true)
            expect(pageContext.canAddWidget('main-content', 'unknown-type')).toBe(true)

            // Sidebar has restrictions
            expect(pageContext.canAddWidget('sidebar', 'text-block')).toBe(true)
            expect(pageContext.canAddWidget('sidebar', 'button')).toBe(false)
        })

        it('should handle inheritance correctly', () => {
            const slot = pageContext.getSlot('main-content')
            expect(slot).toBeInstanceOf(TemplateSlot)
            expect(slot.supportsInheritance).toBe(true)
        })
    })

    describe('Object Widget Context', () => {
        let objectContext
        let mockObjectType
        let mockObjectInstance
        let mockObjectWidgets

        beforeEach(() => {
            mockObjectType = {
                id: 1,
                name: 'Article',
                slotConfiguration: {
                    slots: [
                        {
                            name: 'title',
                            label: 'Article Title',
                            maxWidgets: 1,
                            required: true,
                            widgetControls: [
                                {
                                    id: 'title-control',
                                    widgetType: 'text-block',
                                    label: 'Title Text',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'content',
                            label: 'Article Content',
                            maxWidgets: 5,
                            widgetControls: [
                                {
                                    id: 'text-control',
                                    widgetType: 'text-block',
                                    label: 'Text Content'
                                },
                                {
                                    id: 'image-control',
                                    widgetType: 'image',
                                    label: 'Image'
                                }
                            ]
                        }
                    ]
                }
            }

            mockObjectInstance = {
                id: 1,
                type: 'Article'
            }

            mockObjectWidgets = {
                'title': [
                    {
                        id: 'widget-1',
                        type: 'text-block',
                        controlId: 'title-control',
                        config: { content: 'Article Title' }
                    }
                ]
            }

            objectContext = new ObjectWidgetContext({
                objectType: mockObjectType,
                objectInstance: mockObjectInstance,
                objectWidgets: mockObjectWidgets,
                editable: true
            })
        })

        it('should initialize with correct context type', () => {
            expect(objectContext.type).toBe(SUPPORTED_CONTEXTS.OBJECT)
        })

        it('should return correct slots', () => {
            const slots = objectContext.getSlots()
            expect(slots).toHaveLength(2)

            const titleSlot = slots.find(s => s.id === 'title')
            expect(titleSlot).toBeDefined()
            expect(titleSlot.maxWidgets).toBe(1)
            expect(titleSlot.accepts).toEqual(['text-block'])
        })

        it('should enforce slot restrictions', () => {
            // Title slot only accepts text-block and is limited to 1 widget
            expect(objectContext.canAddWidget('title', 'text-block')).toBe(false) // Already has 1
            expect(objectContext.canAddWidget('title', 'image')).toBe(false) // Wrong type

            // Content slot accepts multiple types
            expect(objectContext.canAddWidget('content', 'text-block')).toBe(true)
            expect(objectContext.canAddWidget('content', 'image')).toBe(true)
            expect(objectContext.canAddWidget('content', 'button')).toBe(false) // Not in controls
        })

        it('should handle widget controls correctly', () => {
            const slot = objectContext.getSlot('content')
            expect(slot).toBeInstanceOf(ConfiguredSlot)
            expect(slot.supportsInheritance).toBe(false)

            const controls = slot.getWidgetControls()
            expect(controls).toHaveLength(2)
            expect(controls[0].widgetType).toBe('text-block')
        })

        it('should validate required controls', async () => {
            const result = await objectContext.save()
            expect(result.success).toBe(true) // Title is filled

            // Remove required title widget
            await objectContext.removeWidget('widget-1')

            const result2 = await objectContext.save()
            expect(result2.success).toBe(false) // Should fail validation
            expect(result2.error).toContain('Required')
        })
    })

    describe('Configuration Manager', () => {
        let configManager

        beforeEach(() => {
            configManager = new ConfigurationManager({
                contextType: SUPPORTED_CONTEXTS.PAGE
            })
        })

        it('should validate widget configuration', () => {
            const widget = {
                id: 'test-widget',
                type: 'text-block',
                config: { content: 'Test content' }
            }

            const result = configManager.validateConfiguration(widget.config, widget)
            expect(result.isValid).toBe(true)
        })

        it('should transform configuration between contexts', () => {
            const pageConfig = {
                content: 'Test',
                inherited: true,
                templateBased: true
            }

            const objectConfig = configManager.transformConfiguration(
                pageConfig,
                SUPPORTED_CONTEXTS.PAGE,
                SUPPORTED_CONTEXTS.OBJECT
            )

            expect(objectConfig.inherited).toBeUndefined()
            expect(objectConfig.templateBased).toBeUndefined()
            expect(objectConfig.content).toBe('Test')
        })

        it('should provide context-appropriate schemas', () => {
            const schema = configManager.getConfigurationSchema('text-block', SUPPORTED_CONTEXTS.PAGE)

            expect(schema.properties.inherited).toBeDefined()
            expect(schema.properties.overrideInheritance).toBeDefined()
        })
    })

    describe('Data Flow Manager', () => {
        let dataManager

        beforeEach(() => {
            dataManager = new DataFlowManager({
                contextType: SUPPORTED_CONTEXTS.PAGE
            })
        })

        it('should store and retrieve widgets', async () => {
            const widget = {
                id: 'test-widget',
                type: 'text-block',
                config: { content: 'Test' }
            }

            const storeResult = await dataManager.storeWidget(widget)
            expect(storeResult.success).toBe(true)

            const retrievedWidget = await dataManager.retrieveWidget('test-widget')
            expect(retrievedWidget.id).toBe('test-widget')
            expect(retrievedWidget.config.content).toBe('Test')
        })

        it('should process widget data for context', () => {
            const widget = {
                id: 'test-widget',
                type: 'text-block',
                config: { content: 'Test' },
                inherited: true
            }

            const processed = dataManager.processWidgetData(widget, {
                contextType: SUPPORTED_CONTEXTS.PAGE,
                operation: 'store'
            })

            expect(processed.inheritanceInfo).toBeDefined()
            expect(processed.pageMetadata).toBeDefined()
        })

        it('should sync multiple widgets', async () => {
            const widgets = [
                {
                    id: 'widget-1',
                    type: 'text-block',
                    config: { content: 'Test 1' }
                },
                {
                    id: 'widget-2',
                    type: 'image',
                    config: { src: 'test.jpg' }
                }
            ]

            const result = await dataManager.syncWidgets(widgets)
            expect(result.success).toBe(true)
            expect(result.results).toHaveLength(2)
        })
    })

    describe('API Client', () => {
        let apiClient

        beforeEach(() => {
            // Mock fetch
            global.fetch = vi.fn()

            apiClient = new ApiClient({
                contextType: SUPPORTED_CONTEXTS.PAGE
            })
        })

        it('should transform request data correctly', () => {
            const data = {
                pageVersionData: { id: 1 },
                widgets: {
                    'main': [{ id: 'w1', canInherit: true }]
                }
            }

            const transformed = apiClient.transformRequest(data)

            expect(transformed.page_version_data).toBeDefined()
            expect(transformed.widgets.main[0].can_inherit).toBe(true)
        })

        it('should transform response data correctly', () => {
            const response = {
                data: {
                    page_version_data: { id: 1 },
                    widgets: {
                        'main': [{ id: 'w1', can_inherit: true }]
                    }
                }
            }

            const transformed = apiClient.transformResponse(response)

            expect(transformed.pageVersionData).toBeDefined()
            expect(transformed.widgets.main[0].canInherit).toBe(true)
        })

        it('should handle API errors gracefully', async () => {
            global.fetch.mockRejectedValue(new Error('HTTP 500: Internal Server Error'))

            const result = await apiClient.saveWidgets({})

            expect(result.success).toBe(false)
            expect(result.type).toBe('server_error')
            expect(result.userMessage).toContain('server error')
        })
    })

    describe('Context Transitions', () => {
        it('should validate context transitions', () => {
            const result = validateContextTransition(
                SUPPORTED_CONTEXTS.PAGE,
                SUPPORTED_CONTEXTS.OBJECT
            )

            expect(result.valid).toBe(true)
            expect(result.canAutoMigrate).toBe(false)
            expect(result.warnings).toContain('inheritance capabilities')
        })

        it('should allow same-context transitions', () => {
            const result = validateContextTransition(
                SUPPORTED_CONTEXTS.PAGE,
                SUPPORTED_CONTEXTS.PAGE
            )

            expect(result.valid).toBe(true)
            expect(result.canAutoMigrate).toBe(true)
            expect(result.warnings).toHaveLength(0)
        })
    })

    describe('Integration Tests', () => {
        it('should work seamlessly across contexts', async () => {
            // Create page context
            const pageContext = createWidgetContext(SUPPORTED_CONTEXTS.PAGE, {
                layoutJson: { slots: { main: {} } },
                pageVersionData: { widgets: {} },
                webpageData: { id: 1 }
            })

            // Add widget
            const widget = {
                id: 'test-widget',
                type: 'text-block',
                config: { content: 'Test' }
            }

            const addResult = await pageContext.addWidget('main', widget)
            expect(addResult.success).toBe(true)

            // Validate
            const validation = pageContext.validateWidget(widget)
            expect(validation.isValid).toBe(true)

            // Save
            const saveResult = await pageContext.save()
            expect(saveResult.success).toBe(true)
        })

        it('should maintain widget portability', () => {
            // Same widget should work in both contexts
            const widget = {
                id: 'portable-widget',
                type: 'text-block',
                config: { content: 'Portable content' }
            }

            // Page context
            const pageContext = createWidgetContext(SUPPORTED_CONTEXTS.PAGE, {
                layoutJson: { slots: { main: {} } },
                pageVersionData: { widgets: {} }
            })

            const pageValidation = pageContext.validateWidget(widget)
            expect(pageValidation.isValid).toBe(true)

            // Object context
            const objectContext = createWidgetContext(SUPPORTED_CONTEXTS.OBJECT, {
                objectType: {
                    slotConfiguration: {
                        slots: [{
                            name: 'main',
                            widgetControls: [{ widgetType: 'text-block' }]
                        }]
                    }
                },
                objectWidgets: {}
            })

            const objectValidation = objectContext.validateWidget(widget)
            expect(objectValidation.isValid).toBe(true)
        })
    })
})

// Test utilities
export const TestUtils = {
    createMockPageProps: () => ({
        layoutJson: {
            slots: {
                'main': { label: 'Main Content' },
                'sidebar': { label: 'Sidebar', maxWidgets: 3 }
            }
        },
        pageVersionData: {
            id: 1,
            widgets: {}
        },
        webpageData: {
            id: 1,
            title: 'Test Page'
        }
    }),

    createMockObjectProps: () => ({
        objectType: {
            id: 1,
            name: 'Test Object',
            slotConfiguration: {
                slots: [{
                    name: 'main',
                    label: 'Main Content',
                    maxWidgets: 1,
                    widgetControls: [{
                        id: 'text-control',
                        widgetType: 'text-block',
                        label: 'Text'
                    }]
                }]
            }
        },
        objectInstance: {
            id: 1,
            type: 'Test Object'
        },
        objectWidgets: {}
    }),

    createMockWidget: (overrides = {}) => ({
        id: `widget-${Date.now()}`,
        type: 'text-block',
        config: { content: 'Test content' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    })
}
