import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { usePageOperations } from '../hooks/usePageOperations';
import { OperationTypes } from '../types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: any }> = ({
    children,
    initialState
}) => (
    <UnifiedDataProvider initialState={initialState}>
        {children}
    </UnifiedDataProvider>
);

describe('Page Operations', () => {
    const pageId = 'test-page-123';

    describe('Page Lifecycle', () => {
        it('should handle page publishing workflow', async () => {
            const initialState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        title: 'Test Page',
                        slug: 'test-page',
                        status: 'draft',
                        metadata: {},
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // Initial state
            expect(result.current.page?.status).toBe('draft');
            expect(result.current.isDraft).toBe(true);
            expect(result.current.isPublished).toBe(false);
            expect(result.current.canPublish).toBe(true);

            // Publish page
            await act(async () => {
                await result.current.publishPage();
            });

            expect(result.current.page?.status).toBe('published');
            expect(result.current.isPublished).toBe(true);
            expect(result.current.isDraft).toBe(false);

            // Unpublish page
            await act(async () => {
                await result.current.unpublishPage();
            });

            expect(result.current.page?.status).toBe('draft');
            expect(result.current.isDraft).toBe(true);
            expect(result.current.isPublished).toBe(false);
        });

        it('should handle page scheduling', async () => {
            const initialState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        title: 'Test Page',
                        slug: 'test-page',
                        status: 'draft',
                        metadata: {},
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const publishAt = new Date(Date.now() + 86400000).toISOString(); // Tomorrow

            await act(async () => {
                await result.current.schedulePage(publishAt);
            });

            expect(result.current.page?.status).toBe('scheduled');
            expect(result.current.isScheduled).toBe(true);
            expect(result.current.page?.metadata.scheduledPublishAt).toBe(publishAt);
        });

        it('should handle page duplication', async () => {
            const initialState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        title: 'Original Page',
                        slug: 'original-page',
                        status: 'published',
                        metadata: { description: 'Original description' },
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                },
                widgets: {
                    'widget-1': {
                        id: 'widget-1',
                        type: 'core_widgets.ContentWidget',
                        pageId: pageId,
                        slot: 'main',
                        config: { content: 'Original content' },
                        order: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            let newPageId: string;

            await act(async () => {
                newPageId = await result.current.duplicatePage('duplicated-page');
            });

            // Verify new page was created
            expect(newPageId).toBeDefined();
            expect(result.current.page).toBeDefined(); // Original page still exists

            // Check if duplicated page exists in state
            const { result: newPageResult } = renderHook(() => usePageOperations(newPageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // Note: We'd need to re-render with updated state to see the duplicated page
            // This test demonstrates the operation structure
        });

        it('should handle page deletion', async () => {
            const initialState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        title: 'Page to Delete',
                        slug: 'page-to-delete',
                        status: 'draft',
                        metadata: {},
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                },
                widgets: {
                    'widget-1': {
                        id: 'widget-1',
                        pageId: pageId,
                        type: 'core_widgets.ContentWidget',
                        slot: 'main',
                        config: {},
                        order: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.page).toBeDefined();

            await act(async () => {
                await result.current.deletePage();
            });

            // Page should be removed from state
            expect(result.current.page).toBeNull();
        });
    });

    describe('Page Metadata', () => {
        it('should update page metadata', async () => {
            const initialState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        title: 'Test Page',
                        slug: 'test-page',
                        status: 'draft',
                        metadata: { description: 'Original description' },
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const newMetadata = {
                description: 'Updated description',
                keywords: ['test', 'page'],
                author: 'Test Author'
            };

            await act(async () => {
                await result.current.updateMetadata(newMetadata);
            });

            expect(result.current.metadata?.description).toBe('Updated description');
            expect(result.current.metadata?.keywords).toEqual(['test', 'page']);
            expect(result.current.metadata?.author).toBe('Test Author');
        });

        it('should update page data', async () => {
            const initialState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        title: 'Original Title',
                        slug: 'original-slug',
                        status: 'draft',
                        metadata: {},
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const updates = {
                title: 'Updated Title',
                slug: 'updated-slug',
                layout: 'two_column'
            };

            await act(async () => {
                await result.current.updatePage(updates);
            });

            expect(result.current.page?.title).toBe('Updated Title');
            expect(result.current.page?.slug).toBe('updated-slug');
            expect(result.current.page?.layout).toBe('two_column');
        });
    });

    describe('Page Status Logic', () => {
        it('should calculate page status correctly', () => {
            const draftState = {
                pages: {
                    [pageId]: {
                        id: pageId,
                        status: 'draft',
                        title: 'Draft Page',
                        slug: 'draft-page',
                        metadata: {},
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result: draftResult } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={draftState} />
            });

            expect(draftResult.current.isDraft).toBe(true);
            expect(draftResult.current.isPublished).toBe(false);
            expect(draftResult.current.isScheduled).toBe(false);
            expect(draftResult.current.canPublish).toBe(true);
            expect(draftResult.current.canEdit).toBe(true);
        });
    });
});
