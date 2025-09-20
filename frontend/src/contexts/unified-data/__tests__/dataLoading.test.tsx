import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useDataLoader } from '../hooks/useDataLoader';
import { useWidgetSync } from '../hooks/useWidgetSync';
import { normalizeSlotWidgets, denormalizeWidgetsToSlots } from '../utils/dataLoaders';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider>
        {children}
    </UnifiedDataProvider>
);

describe('Data Loading Integration', () => {
    const mockPageData = {
        id: 'page-123',
        title: 'Test Page',
        slug: 'test-page',
        description: 'Test page description',
        status: 'draft'
    };

    const mockVersionData = {
        id: 'version-456',
        page_id: 'page-123',
        number: 1,
        widgets: {
            main: [
                {
                    id: 'widget-1',
                    type: 'core_widgets.ContentWidget',
                    config: { content: 'Hello World' }
                },
                {
                    id: 'widget-2',
                    type: 'core_widgets.ImageWidget',
                    config: { imageUrl: 'test.jpg' }
                }
            ],
            sidebar: [
                {
                    id: 'widget-3',
                    type: 'core_widgets.ContentWidget',
                    config: { content: 'Sidebar content' }
                }
            ]
        }
    };

    const mockLayoutData = {
        id: 'layout-789',
        name: 'two_column',
        slots: [
            { id: 'main', name: 'Main Content' },
            { id: 'sidebar', name: 'Sidebar' }
        ]
    };

    describe('useDataLoader', () => {
        it('should load page data into UnifiedDataContext', async () => {
            const { result } = renderHook(() => useDataLoader(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.loadPageData(
                    mockPageData,
                    mockVersionData,
                    mockLayoutData
                );
            });

            // Verify data was loaded
            const slotWidgets = result.current.getWidgetsAsSlots();
            expect(slotWidgets.main).toHaveLength(2);
            expect(slotWidgets.sidebar).toHaveLength(1);
            expect(slotWidgets.main[0].config.content).toBe('Hello World');
        });

        it('should load widgets from slot format', async () => {
            const { result } = renderHook(() => useDataLoader(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.loadWidgets(mockVersionData.widgets, 'page-123');
            });

            const slotWidgets = result.current.getWidgetsAsSlots();
            expect(slotWidgets.main).toHaveLength(2);
            expect(slotWidgets.sidebar).toHaveLength(1);
        });

        it('should convert widgets back to slot format', async () => {
            const { result } = renderHook(() => useDataLoader(), {
                wrapper: TestWrapper
            });

            // Load data first
            await act(async () => {
                await result.current.loadPageData(
                    mockPageData,
                    mockVersionData,
                    mockLayoutData
                );
            });

            // Convert back to slots
            const slotWidgets = result.current.getWidgetsAsSlots();

            expect(slotWidgets).toEqual(expect.objectContaining({
                main: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'widget-1',
                        type: 'core_widgets.ContentWidget',
                        config: { content: 'Hello World' }
                    })
                ]),
                sidebar: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'widget-3',
                        config: { content: 'Sidebar content' }
                    })
                ])
            }));
        });
    });

    describe('useWidgetSync', () => {
        it('should determine primary data source', async () => {
            const { result } = renderHook(() => {
                const dataLoader = useDataLoader();
                const widgetSync = useWidgetSync('page-123');
                return { dataLoader, widgetSync };
            }, {
                wrapper: TestWrapper
            });

            // Initially, context should not be primary (empty)
            expect(result.current.widgetSync.isContextPrimary).toBe(false);
            expect(result.current.widgetSync.getWidgetSource()).toBe('local');

            // Load data into context
            await act(async () => {
                await result.current.dataLoader.loadPageData(
                    mockPageData,
                    mockVersionData,
                    mockLayoutData
                );
            });

            // Now context should be primary
            expect(result.current.widgetSync.isContextPrimary).toBe(true);
            expect(result.current.widgetSync.getWidgetSource()).toBe('context');
        });

        it('should sync widgets between formats', async () => {
            const { result } = renderHook(() => useWidgetSync('page-123'), {
                wrapper: TestWrapper
            });

            // Sync slot widgets to context
            await act(async () => {
                await result.current.syncWidgetsToContext(
                    mockVersionData.widgets,
                    'page-123'
                );
            });

            // Get widgets back from context
            const slotWidgets = result.current.syncWidgetsFromContext();

            expect(slotWidgets.main).toHaveLength(2);
            expect(slotWidgets.sidebar).toHaveLength(1);
            expect(slotWidgets.main[0].id).toBe('widget-1');
        });
    });

    describe('Data Normalization', () => {
        it('should normalize slot widgets correctly', () => {
            const normalized = normalizeSlotWidgets(mockVersionData.widgets, 'page-123');

            expect(normalized['widget-1']).toEqual(expect.objectContaining({
                id: 'widget-1',
                type: 'core_widgets.ContentWidget',
                slot: 'main',
                pageId: 'page-123',
                config: { content: 'Hello World' }
            }));

            expect(normalized['widget-3']).toEqual(expect.objectContaining({
                id: 'widget-3',
                slot: 'sidebar',
                pageId: 'page-123'
            }));
        });

        it('should denormalize widgets back to slots', () => {
            const normalized = normalizeSlotWidgets(mockVersionData.widgets, 'page-123');
            const denormalized = denormalizeWidgetsToSlots(normalized);

            expect(denormalized.main).toHaveLength(2);
            expect(denormalized.sidebar).toHaveLength(1);
            expect(denormalized.main[0]).toEqual(expect.objectContaining({
                id: 'widget-1',
                type: 'core_widgets.ContentWidget',
                config: { content: 'Hello World' }
            }));
        });

        it('should maintain data integrity through round-trip conversion', () => {
            // Slot format → Normalized → Slot format
            const normalized = normalizeSlotWidgets(mockVersionData.widgets, 'page-123');
            const denormalized = denormalizeWidgetsToSlots(normalized);

            // Should match original structure
            expect(denormalized.main).toHaveLength(mockVersionData.widgets.main.length);
            expect(denormalized.sidebar).toHaveLength(mockVersionData.widgets.sidebar.length);

            // Check specific widget data
            const originalWidget1 = mockVersionData.widgets.main[0];
            const roundTripWidget1 = denormalized.main.find(w => w.id === originalWidget1.id);

            expect(roundTripWidget1).toEqual(expect.objectContaining({
                id: originalWidget1.id,
                type: originalWidget1.type,
                config: originalWidget1.config
            }));
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete page loading workflow', async () => {
            const { result } = renderHook(() => {
                const dataLoader = useDataLoader();
                const widgetSync = useWidgetSync('page-123');
                return { dataLoader, widgetSync };
            }, {
                wrapper: TestWrapper
            });

            // 1. Load page data (simulating PageEditor data fetch)
            await act(async () => {
                await result.current.dataLoader.loadPageData(
                    mockPageData,
                    mockVersionData,
                    mockLayoutData
                );
            });

            // 2. Verify UnifiedDataContext is now primary
            expect(result.current.widgetSync.isContextPrimary).toBe(true);

            // 3. Get widgets in PageEditor format
            const slotWidgets = result.current.widgetSync.syncWidgetsFromContext();
            expect(slotWidgets.main).toHaveLength(2);

            // 4. Simulate widget change in PageEditor
            const updatedSlotWidgets = {
                ...slotWidgets,
                main: [
                    ...slotWidgets.main,
                    {
                        id: 'new-widget',
                        type: 'core_widgets.ContentWidget',
                        config: { content: 'New widget' }
                    }
                ]
            };

            // 5. Sync back to context
            await act(async () => {
                await result.current.widgetSync.syncWidgetsToContext(
                    updatedSlotWidgets,
                    'page-123'
                );
            });

            // 6. Verify sync worked
            const finalSlotWidgets = result.current.widgetSync.syncWidgetsFromContext();
            expect(finalSlotWidgets.main).toHaveLength(3);
            expect(finalSlotWidgets.main.find(w => w.id === 'new-widget')).toBeDefined();
        });
    });
});
