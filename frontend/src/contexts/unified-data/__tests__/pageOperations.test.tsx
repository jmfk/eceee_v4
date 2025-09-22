import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../v2/context/UnifiedDataContext';
import { usePageOperations } from '../v2/hooks/usePageOperations';
import { OperationTypes } from '../v2/types/operations';
import { UnifiedState } from '../v2/types/state';

const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: Partial<UnifiedState> }> = ({
    children,
    initialState
}) => (
    <UnifiedDataProvider
        initialState={initialState}
        options={{
            enablePageOperations: true
        }}
    >
        {children}
    </UnifiedDataProvider>
);

describe('Page Operations v2', () => {
    const pageId = 'test-page-123';

    describe('Page Lifecycle', () => {
        it('should handle page publishing workflow', async () => {
            const initialState: Partial<UnifiedState> = {
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
            expect(result.current.getPageState().status).toBe('draft');
            expect(result.current.getPageState().isDraft).toBe(true);
            expect(result.current.getPageState().isPublished).toBe(false);
            expect(result.current.getPageState().canPublish).toBe(true);

            // Publish page
            await act(async () => {
                await result.current.publish();
            });

            expect(result.current.getPageState().status).toBe('published');
            expect(result.current.getPageState().isPublished).toBe(true);
            expect(result.current.getPageState().isDraft).toBe(false);

            // Unpublish page
            await act(async () => {
                await result.current.unpublish();
            });

            expect(result.current.getPageState().status).toBe('draft');
            expect(result.current.getPageState().isDraft).toBe(true);
            expect(result.current.getPageState().isPublished).toBe(false);
        });

        it('should handle page scheduling', async () => {
            const initialState: Partial<UnifiedState> = {
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
                await result.current.schedule(publishAt);
            });

            expect(result.current.getPageState().status).toBe('scheduled');
            expect(result.current.getPageState().isScheduled).toBe(true);
            expect(result.current.getPageState().scheduledPublishAt).toBe(publishAt);
        });

        it('should handle page duplication', async () => {
            const initialState: Partial<UnifiedState> = {
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
                        slotName: 'main',
                        config: { content: 'Original content' },
                        order: 0
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            let newPageId: string;

            await act(async () => {
                newPageId = await result.current.duplicate('duplicated-page');
            });

            // Verify new page was created
            expect(newPageId).toBeDefined();
            expect(result.current.getPageState().id).toBe(pageId); // Original page still exists

            // Check if duplicated page exists in state
            const { result: newPageResult } = renderHook(() => usePageOperations(newPageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(newPageResult.current.getPageState().id).toBe(newPageId);
            expect(newPageResult.current.getPageState().status).toBe('draft');
        });

        it('should handle page deletion', async () => {
            const initialState: Partial<UnifiedState> = {
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
                        slotName: 'main',
                        config: {},
                        order: 0
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.getPageState().id).toBe(pageId);

            await act(async () => {
                await result.current.delete();
            });

            // Page should be removed from state
            expect(result.current.getPageState().exists).toBe(false);
        });
    });

    describe('Page Metadata', () => {
        it('should update page metadata', async () => {
            const initialState: Partial<UnifiedState> = {
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

            expect(result.current.getPageState().metadata.description).toBe('Updated description');
            expect(result.current.getPageState().metadata.keywords).toEqual(['test', 'page']);
            expect(result.current.getPageState().metadata.author).toBe('Test Author');
        });

        it('should update page data', async () => {
            const initialState: Partial<UnifiedState> = {
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
                await result.current.update(updates);
            });

            expect(result.current.getPageState().title).toBe('Updated Title');
            expect(result.current.getPageState().slug).toBe('updated-slug');
            expect(result.current.getPageState().layout).toBe('two_column');
        });
    });

    describe('Page Status Logic', () => {
        it('should calculate page status correctly', () => {
            const draftState: Partial<UnifiedState> = {
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

            expect(draftResult.current.getPageState().isDraft).toBe(true);
            expect(draftResult.current.getPageState().isPublished).toBe(false);
            expect(draftResult.current.getPageState().isScheduled).toBe(false);
            expect(draftResult.current.getPageState().canPublish).toBe(true);
            expect(draftResult.current.getPageState().canEdit).toBe(true);
        });

        it('should handle invalid page states', () => {
            const { result } = renderHook(() => usePageOperations('non-existent-page'), {
                wrapper: TestWrapper
            });

            expect(result.current.getPageState().exists).toBe(false);
            expect(result.current.getPageState().canPublish).toBe(false);
            expect(result.current.getPageState().canEdit).toBe(false);
        });
    });
});