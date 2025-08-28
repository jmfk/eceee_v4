/**
 * Tests for MediaBrowser Component
 * 
 * Tests cover:
 * - Media file display and grid layout
 * - Search and filtering functionality
 * - Pagination and infinite scroll
 * - File selection (single and multiple)
 * - Collection and tag management
 * - Sorting and view options
 * - Error handling and loading states
 * - Accessibility compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MediaBrowser from '../media/MediaBrowser';
import * as mediaApi from '../../api/media';
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext';

// Mock the media API
vi.mock('../../api/media', () => ({
    mediaApi: {
        files: {
            list: vi.fn(),
            get: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        upload: {
            single: vi.fn(),
            multiple: vi.fn()
        },
        search: {
            search: vi.fn()
        },
        tags: {
            list: vi.fn(),
            create: vi.fn()
        },
        collections: {
            list: vi.fn(),
            create: vi.fn()
        },
        bulkOperations: {
            execute: vi.fn()
        },
        pendingFiles: {
            list: vi.fn(),
            approve: vi.fn(),
            reject: vi.fn()
        }
    },
    mediaTagsApi: {
        list: vi.fn(),
        create: vi.fn()
    },
    mediaCollectionsApi: {
        list: vi.fn(),
        create: vi.fn()
    },
    default: {
        files: {
            list: vi.fn(),
            get: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        upload: {
            single: vi.fn(),
            multiple: vi.fn()
        },
        search: {
            search: vi.fn()
        },
        tags: {
            list: vi.fn(),
            create: vi.fn()
        },
        collections: {
            list: vi.fn(),
            create: vi.fn()
        },
        bulkOperations: {
            execute: vi.fn()
        },
        pendingFiles: {
            list: vi.fn(),
            approve: vi.fn(),
            reject: vi.fn()
        }
    }
}));

// Mock IntersectionObserver for infinite scroll
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Test data
const mockMediaFiles = [
    {
        id: '1',
        title: 'Test Image 1',
        file_url: 'https://example.com/test1.jpg',
        file_type: 'image/jpeg',
        file_size: 1024000,
        created_at: '2024-01-01T10:00:00Z',
        tags: ['nature', 'landscape'],
        thumbnails: {
            small: 'https://example.com/test1_small.jpg',
            medium: 'https://example.com/test1_medium.jpg',
        },
    },
    {
        id: '2',
        title: 'Test Video',
        file_url: 'https://example.com/test.mp4',
        file_type: 'video/mp4',
        file_size: 5120000,
        created_at: '2024-01-02T10:00:00Z',
        tags: ['demo'],
        thumbnails: {
            small: 'https://example.com/test_video_small.jpg',
            medium: 'https://example.com/test_video_medium.jpg',
        },
    },
    {
        id: '3',
        title: 'Test Document',
        file_url: 'https://example.com/test.pdf',
        file_type: 'application/pdf',
        file_size: 2048000,
        created_at: '2024-01-03T10:00:00Z',
        tags: ['document'],
        thumbnails: {},
    },
];

const mockCollections = [
    {
        id: '1',
        title: 'Nature Photos',
        file_count: 5,
    },
    {
        id: '2',
        title: 'Marketing Assets',
        file_count: 12,
    },
];

const mockTags = [
    { id: '1', name: 'nature', usage_count: 10 },
    { id: '2', name: 'landscape', usage_count: 8 },
    { id: '3', name: 'demo', usage_count: 3 },
];

// Test wrapper component
function TestWrapper({ children }) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <GlobalNotificationProvider>
                {children}
            </GlobalNotificationProvider>
        </QueryClientProvider>
    );
}

describe('MediaBrowser', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();

        // Setup default API mocks
        mediaApi.mediaApi.search.search.mockResolvedValue({
            results: mockMediaFiles,
            count: 3,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        });

        mediaApi.mediaCollectionsApi.list.mockResolvedValue({
            results: mockCollections,
        });

        mediaApi.mediaTagsApi.list.mockResolvedValue({
            results: mockTags,
        });

        mediaApi.mediaApi.tags.list.mockResolvedValue({
            results: mockTags,
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render media files in grid layout', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} namespace="test-namespace" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
                expect(screen.getByText('Test Video')).toBeInTheDocument();
                expect(screen.getByText('Test Document')).toBeInTheDocument();
            });

            // Should show file headings
            const headings = screen.getAllByRole('heading');
            expect(headings).toHaveLength(3); // All three files should have headings
        });

        it('should display file metadata correctly', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('1.0 MB')).toBeInTheDocument(); // File size
                expect(screen.getByText('5.0 MB')).toBeInTheDocument();
                expect(screen.getByText('image/jpeg')).toBeInTheDocument(); // File type
                expect(screen.getByText('video/mp4')).toBeInTheDocument();
            });
        });

        it('should show loading state initially', () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });

        it('should handle empty results', async () => {
            mediaApi.mediaApi.search.search.mockResolvedValue({
                results: [],
                count: 0,
                page: 1,
                pageSize: 20,
                totalPages: 1,
            });

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/no media files found/i)).toBeInTheDocument();
            });
        });
    });

    describe('File Selection', () => {
        it('should handle single file selection', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={mockOnSelect} multiple={false} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            const fileCard = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            await user.click(fileCard);

            expect(mockOnSelect).toHaveBeenCalledWith(mockMediaFiles[0]);
        });

        it('should handle multiple file selection', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={mockOnSelect} multiple={true} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            // Select multiple files
            const file1 = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            const file2 = screen.getByText('Test Video').closest('[data-testid="media-file"]');

            await user.click(file1);
            await user.click(file2);

            // Should show selection count
            expect(screen.getByText('2 selected')).toBeInTheDocument();

            // Click confirm selection button
            const confirmButton = screen.getByRole('button', { name: /confirm selection/i });
            await user.click(confirmButton);

            expect(mockOnSelect).toHaveBeenCalledWith([mockMediaFiles[0], mockMediaFiles[1]]);
        });

        it('should show selection checkboxes in multiple mode', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} multiple={true} />
                </TestWrapper>
            );

            await waitFor(() => {
                const checkboxes = screen.getAllByRole('checkbox');
                expect(checkboxes.length).toBeGreaterThan(0);
            });
        });

        it('should enforce selection limits', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} multiple={true} maxItems={1} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            const file1 = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            const file2 = screen.getByText('Test Video').closest('[data-testid="media-file"]');

            await user.click(file1);
            await user.click(file2);

            // Should show limit warning
            expect(screen.getByText(/maximum.*1.*file/i)).toBeInTheDocument();
        });

        it('should clear selection when switching modes', async () => {
            const { rerender } = render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} multiple={true} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            // Select a file
            const file1 = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            await user.click(file1);

            expect(screen.getByText('1 selected')).toBeInTheDocument();

            // Switch to single selection mode
            rerender(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} multiple={false} />
                </TestWrapper>
            );

            // Selection should be cleared
            expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
        });
    });

    describe('Search and Filtering', () => {
        it('should have search input field', () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const searchInput = screen.getByPlaceholderText(/search media/i);
            expect(searchInput).toBeInTheDocument();
        });

        it('should perform search when typing', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const searchInput = screen.getByPlaceholderText(/search media/i);
            await user.type(searchInput, 'nature');

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        search: 'nature',
                    })
                );
            });
        });

        it('should filter by file type', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const typeFilter = screen.getByLabelText(/file type/i);
            await user.selectOptions(typeFilter, 'image');

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file_type: 'image',
                    })
                );
            });
        });

        it('should filter by tags', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('nature')).toBeInTheDocument();
            });

            const natureTag = screen.getByText('nature');
            await user.click(natureTag);

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tags: 'nature',
                    })
                );
            });
        });

        it('should filter by collection', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Nature Photos')).toBeInTheDocument();
            });

            const collection = screen.getByText('Nature Photos');
            await user.click(collection);

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        collection: '1',
                    })
                );
            });
        });

        it('should respect mediaTypes prop for filtering', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} mediaTypes={['image']} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file_type: 'image',
                    })
                );
            });
        });

        it('should clear filters', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            // Apply some filters
            const searchInput = screen.getByPlaceholderText(/search media/i);
            await user.type(searchInput, 'test');

            const typeFilter = screen.getByLabelText(/file type/i);
            await user.selectOptions(typeFilter, 'image');

            // Clear filters
            const clearButton = screen.getByRole('button', { name: /clear filters/i });
            await user.click(clearButton);

            expect(searchInput.value).toBe('');
            expect(typeFilter.value).toBe('');
        });
    });

    describe('Sorting and View Options', () => {
        it('should have sorting options', () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const sortSelect = screen.getByLabelText(/sort by/i);
            expect(sortSelect).toBeInTheDocument();

            const options = within(sortSelect).getAllByRole('option');
            expect(options.map(opt => opt.textContent)).toContain('Date Created');
            expect(options.map(opt => opt.textContent)).toContain('File Name');
            expect(options.map(opt => opt.textContent)).toContain('File Size');
        });

        it('should sort files by different criteria', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const sortSelect = screen.getByLabelText(/sort by/i);
            await user.selectOptions(sortSelect, 'file_size');

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        ordering: 'file_size',
                    })
                );
            });
        });

        it('should toggle sort direction', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const sortDirectionButton = screen.getByRole('button', { name: /sort direction/i });
            await user.click(sortDirectionButton);

            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledWith(
                    expect.objectContaining({
                        ordering: expect.stringMatching(/^-/), // Should start with minus for descending
                    })
                );
            });
        });

        it('should have view mode options', () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const gridViewButton = screen.getByRole('button', { name: /grid view/i });
            const listViewButton = screen.getByRole('button', { name: /list view/i });

            expect(gridViewButton).toBeInTheDocument();
            expect(listViewButton).toBeInTheDocument();
        });

        it('should switch between grid and list views', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const listViewButton = screen.getByRole('button', { name: /list view/i });
            await user.click(listViewButton);

            // Should change layout class or structure
            const container = screen.getByTestId('media-grid');
            expect(container).toHaveClass('list-view');
        });
    });

    describe('Pagination and Infinite Scroll', () => {
        it('should show pagination controls', async () => {
            mediaApi.mediaApi.search.search.mockResolvedValue({
                results: mockMediaFiles,
                count: 50,
                next: 'http://api.example.com/media/?page=2',
                previous: null,
            });

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/1.*of.*\d+/)).toBeInTheDocument(); // Page indicator
            });
        });

        it('should load more files on scroll', async () => {
            const page1Results = mockMediaFiles.slice(0, 2);
            const page2Results = mockMediaFiles.slice(2);

            mediaApi.mediaApi.search.search
                .mockResolvedValueOnce({
                    results: page1Results,
                    count: 3,
                    next: 'http://api.example.com/media/?page=2',
                    previous: null,
                })
                .mockResolvedValueOnce({
                    results: page2Results,
                    count: 3,
                    next: null,
                    previous: 'http://api.example.com/media/?page=1',
                });

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
                expect(screen.getByText('Test Video')).toBeInTheDocument();
            });

            // Simulate scroll to bottom
            const loadMoreTrigger = screen.getByTestId('load-more-trigger');
            fireEvent.scroll(loadMoreTrigger);

            await waitFor(() => {
                expect(screen.getByText('Test Document')).toBeInTheDocument();
            });

            expect(mediaApi.mediaApi.search.search).toHaveBeenCalledTimes(2);
        });

        it('should show loading indicator when loading more', async () => {
            mediaApi.mediaApi.search.search.mockResolvedValue({
                results: mockMediaFiles,
                count: 50,
                next: 'http://api.example.com/media/?page=2',
                previous: null,
            });

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            // Trigger load more
            const loadMoreTrigger = screen.getByTestId('load-more-trigger');
            fireEvent.scroll(loadMoreTrigger);

            expect(screen.getByText(/loading more/i)).toBeInTheDocument();
        });
    });

    describe('Collections and Tags', () => {
        it('should display available collections', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Nature Photos')).toBeInTheDocument();
                expect(screen.getByText('Marketing Assets')).toBeInTheDocument();
                expect(screen.getByText('5')).toBeInTheDocument(); // File count
                expect(screen.getByText('12')).toBeInTheDocument();
            });
        });

        it('should display available tags with usage counts', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('nature')).toBeInTheDocument();
                expect(screen.getByText('landscape')).toBeInTheDocument();
                expect(screen.getByText('10')).toBeInTheDocument(); // Usage count
                expect(screen.getByText('8')).toBeInTheDocument();
            });
        });

        it('should allow creating new collections', async () => {
            mediaApi.mediaCollectionsApi.create.mockResolvedValue({
                id: '3', title: 'New Collection', file_count: 0,
            });

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const createButton = screen.getByRole('button', { name: /create collection/i });
            await user.click(createButton);

            const nameInput = screen.getByPlaceholderText(/collection name/i);
            await user.type(nameInput, 'New Collection');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(mediaApi.mediaCollectionsApi.create).toHaveBeenCalledWith({
                    title: 'New Collection',
                });
            });
        });

        it('should show file tags on hover or selection', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            const fileCard = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            await user.hover(fileCard);

            await waitFor(() => {
                expect(screen.getByText('nature')).toBeInTheDocument();
                expect(screen.getByText('landscape')).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            mediaApi.mediaApi.search.search.mockRejectedValue(new Error('API Error'));

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/error loading media/i)).toBeInTheDocument();
            });
        });

        it('should show retry option on error', async () => {
            mediaApi.mediaApi.search.search.mockRejectedValue(new Error('Network Error'));

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
            });

            const retryButton = screen.getByRole('button', { name: /retry/i });
            await user.click(retryButton);

            expect(mediaApi.mediaApi.search.search).toHaveBeenCalledTimes(2);
        });

        it('should handle image loading errors', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                const images = screen.getAllByRole('img');
                expect(images.length).toBeGreaterThan(0);
            });

            // Simulate image load error
            const image = screen.getAllByRole('img')[0];
            fireEvent.error(image);

            // Should show fallback or placeholder
            expect(image).toHaveAttribute('src', expect.stringMatching(/placeholder|fallback/));
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels and roles', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                const grid = screen.getByRole('grid');
                expect(grid).toBeInTheDocument();

                const gridCells = screen.getAllByRole('gridcell');
                expect(gridCells.length).toBeGreaterThan(0);
            });
        });

        it('should support keyboard navigation', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            // Should be able to navigate with arrow keys
            const firstFile = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            firstFile.focus();

            await user.keyboard('{ArrowRight}');

            // Focus should move to next file
            const secondFile = screen.getByText('Test Video').closest('[data-testid="media-file"]');
            expect(document.activeElement).toBe(secondFile);
        });

        it('should announce selection changes to screen readers', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} multiple={true} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Test Image 1')).toBeInTheDocument();
            });

            const file1 = screen.getByText('Test Image 1').closest('[data-testid="media-file"]');
            await user.click(file1);

            // Should have aria-live region for announcements
            const statusRegion = screen.getByRole('status');
            expect(statusRegion).toHaveTextContent(/1.*selected/i);
        });

        it('should have accessible form controls', () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const searchInput = screen.getByLabelText(/search/i);
            expect(searchInput).toBeInTheDocument();

            const sortSelect = screen.getByLabelText(/sort/i);
            expect(sortSelect).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        it('should virtualize large lists for performance', async () => {
            const manyFiles = Array.from({ length: 1000 }, (_, i) => ({
                ...mockMediaFiles[0],
                id: `file-${i}`,
                title: `File ${i}`,
            }));

            mediaApi.mediaApi.search.search.mockResolvedValue({
                results: manyFiles,
                count: 1000,
                next: null,
                previous: null,
            });

            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            await waitFor(() => {
                // Should only render visible items, not all 1000
                const renderedFiles = screen.getAllByTestId('media-file');
                expect(renderedFiles.length).toBeLessThan(100);
            });
        });

        it('should debounce search input', async () => {
            render(
                <TestWrapper>
                    <MediaBrowser onSelect={vi.fn()} />
                </TestWrapper>
            );

            const searchInput = screen.getByPlaceholderText(/search media/i);

            // Type quickly
            await user.type(searchInput, 'test query');

            // Should only make one API call after debounce delay
            await waitFor(() => {
                expect(mediaApi.mediaApi.search.search).toHaveBeenCalledTimes(2); // Initial load + search
            });
        });
    });
});
