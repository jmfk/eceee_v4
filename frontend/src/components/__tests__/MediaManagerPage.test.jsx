/**
 * Tests for MediaManagerPage Component
 * 
 * Tests cover:
 * - Page layout and navigation
 * - MediaBrowser integration
 * - Upload functionality
 * - File management operations
 * - Search and filtering
 * - Bulk operations
 * - Error handling and loading states
 * - Accessibility compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import MediaManagerPage from '../../pages/MediaManagerPage';
import * as mediaApi from '../../api/media';

// Mock the media API
vi.mock('../../api/media', () => ({
    searchMedia: vi.fn(),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    bulkDelete: vi.fn(),
    getMediaCollections: vi.fn(),
    getMediaTags: vi.fn(),
    createCollection: vi.fn(),
    addToCollection: vi.fn(),
}));

// Mock MediaBrowser component
vi.mock('../media/MediaBrowser', () => {
    return function MockMediaBrowser({ onSelect, onDelete, onBulkAction }) {
        return (
            <div data-testid="media-browser">
                <div data-testid="media-files">
                    <div data-testid="media-file-1">Test Image 1</div>
                    <div data-testid="media-file-2">Test Video</div>
                    <div data-testid="media-file-3">Test Document</div>
                </div>
                <button
                    onClick={() => onSelect?.({ id: '1', title: 'Test Image 1' })}
                    data-testid="select-file-btn"
                >
                    Select File
                </button>
                <button
                    onClick={() => onDelete?.('1')}
                    data-testid="delete-file-btn"
                >
                    Delete File
                </button>
                <button
                    onClick={() => onBulkAction?.('delete', ['1', '2'])}
                    data-testid="bulk-delete-btn"
                >
                    Bulk Delete
                </button>
            </div>
        );
    };
});

// Mock file upload component
vi.mock('../media/FileUpload', () => {
    return function MockFileUpload({ onUpload, onProgress, onError }) {
        return (
            <div data-testid="file-upload">
                <input
                    type="file"
                    data-testid="file-input"
                    onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                            onProgress?.(50);
                            setTimeout(() => {
                                onUpload?.({
                                    id: 'uploaded-1',
                                    title: file.name,
                                    file_url: 'https://example.com/uploaded.jpg',
                                });
                            }, 100);
                        }
                    }}
                />
                <div data-testid="upload-progress">Upload Progress</div>
            </div>
        );
    };
});

// Test data
const mockMediaFiles = [
    {
        id: '1',
        title: 'Test Image 1',
        file_url: 'https://example.com/test1.jpg',
        file_type: 'image/jpeg',
        file_size: 1024000,
        created_at: '2024-01-01T10:00:00Z',
    },
    {
        id: '2',
        title: 'Test Video',
        file_url: 'https://example.com/test.mp4',
        file_type: 'video/mp4',
        file_size: 5120000,
        created_at: '2024-01-02T10:00:00Z',
    },
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
            <BrowserRouter>
                {children}
            </BrowserRouter>
        </QueryClientProvider>
    );
}

describe('MediaManagerPage', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();

        // Setup default API mocks
        mediaApi.searchMedia.mockResolvedValue({
            data: {
                results: mockMediaFiles,
                count: 2,
                next: null,
                previous: null,
            },
        });

        mediaApi.getMediaCollections.mockResolvedValue({
            data: { results: [] },
        });

        mediaApi.getMediaTags.mockResolvedValue({
            data: { results: [] },
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render page header and navigation', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByRole('heading', { name: /media manager/i })).toBeInTheDocument();
            expect(screen.getByText(/manage your media files/i)).toBeInTheDocument();
        });

        it('should render MediaBrowser component', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByTestId('media-browser')).toBeInTheDocument();
        });

        it('should show upload area', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByTestId('file-upload')).toBeInTheDocument();
        });

        it('should display media statistics', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/2.*files/i)).toBeInTheDocument();
            });
        });
    });

    describe('File Upload', () => {
        it('should handle file upload', async () => {
            mediaApi.uploadFile.mockResolvedValue({
                data: {
                    id: 'uploaded-1',
                    title: 'uploaded.jpg',
                    file_url: 'https://example.com/uploaded.jpg',
                },
            });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const fileInput = screen.getByTestId('file-input');
            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(screen.getByText(/upload.*success/i)).toBeInTheDocument();
            });
        });

        it('should show upload progress', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const fileInput = screen.getByTestId('file-input');
            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
        });

        it('should handle upload errors', async () => {
            mediaApi.uploadFile.mockRejectedValue(new Error('Upload failed'));

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const fileInput = screen.getByTestId('file-input');
            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(screen.getByText(/upload.*failed/i)).toBeInTheDocument();
            });
        });

        it('should refresh media list after upload', async () => {
            mediaApi.uploadFile.mockResolvedValue({
                data: {
                    id: 'uploaded-1',
                    title: 'uploaded.jpg',
                    file_url: 'https://example.com/uploaded.jpg',
                },
            });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const fileInput = screen.getByTestId('file-input');
            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2); // Initial load + refresh
            });
        });
    });

    describe('File Management', () => {
        it('should handle file selection', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-file-btn');
            await user.click(selectButton);

            // Should show file details panel
            expect(screen.getByText(/file details/i)).toBeInTheDocument();
        });

        it('should handle file deletion', async () => {
            mediaApi.deleteFile.mockResolvedValue({ data: { success: true } });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const deleteButton = screen.getByTestId('delete-file-btn');
            await user.click(deleteButton);

            // Should show confirmation dialog
            expect(screen.getByText(/confirm.*delete/i)).toBeInTheDocument();

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(mediaApi.deleteFile).toHaveBeenCalledWith('1');
            });
        });

        it('should handle bulk operations', async () => {
            mediaApi.bulkDelete.mockResolvedValue({ data: { success: true } });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const bulkDeleteButton = screen.getByTestId('bulk-delete-btn');
            await user.click(bulkDeleteButton);

            // Should show confirmation dialog
            expect(screen.getByText(/confirm.*delete.*2.*files/i)).toBeInTheDocument();

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(mediaApi.bulkDelete).toHaveBeenCalledWith(['1', '2']);
            });
        });

        it('should refresh media list after deletion', async () => {
            mediaApi.deleteFile.mockResolvedValue({ data: { success: true } });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const deleteButton = screen.getByTestId('delete-file-btn');
            await user.click(deleteButton);

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2); // Initial load + refresh
            });
        });
    });

    describe('Search and Filtering', () => {
        it('should have search functionality', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByPlaceholderText(/search media/i)).toBeInTheDocument();
        });

        it('should perform search', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const searchInput = screen.getByPlaceholderText(/search media/i);
            await user.type(searchInput, 'test query');

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        search: 'test query',
                    })
                );
            });
        });

        it('should have filter options', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByLabelText(/file type/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
        });

        it('should apply filters', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const typeFilter = screen.getByLabelText(/file type/i);
            await user.selectOptions(typeFilter, 'image');

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file_type: 'image',
                    })
                );
            });
        });

        it('should clear filters', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            // Apply filters first
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

    describe('View Options', () => {
        it('should have view mode toggles', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument();
        });

        it('should switch between view modes', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const listViewButton = screen.getByRole('button', { name: /list view/i });
            await user.click(listViewButton);

            // Should update view mode
            expect(listViewButton).toHaveClass('active');
        });

        it('should have sorting options', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
        });

        it('should apply sorting', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const sortSelect = screen.getByLabelText(/sort by/i);
            await user.selectOptions(sortSelect, 'file_size');

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        ordering: 'file_size',
                    })
                );
            });
        });
    });

    describe('File Details Panel', () => {
        it('should show file details when file is selected', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-file-btn');
            await user.click(selectButton);

            expect(screen.getByText(/file details/i)).toBeInTheDocument();
            expect(screen.getByText('Test Image 1')).toBeInTheDocument();
        });

        it('should allow editing file metadata', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-file-btn');
            await user.click(selectButton);

            const editButton = screen.getByRole('button', { name: /edit/i });
            await user.click(editButton);

            expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/alt text/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        });

        it('should show file usage information', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-file-btn');
            await user.click(selectButton);

            expect(screen.getByText(/used in/i)).toBeInTheDocument();
        });

        it('should close details panel', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-file-btn');
            await user.click(selectButton);

            const closeButton = screen.getByRole('button', { name: /close/i });
            await user.click(closeButton);

            expect(screen.queryByText(/file details/i)).not.toBeInTheDocument();
        });
    });

    describe('Collections Management', () => {
        it('should show collections sidebar', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByText(/collections/i)).toBeInTheDocument();
        });

        it('should allow creating new collections', async () => {
            mediaApi.createCollection.mockResolvedValue({
                data: { id: '1', title: 'New Collection', file_count: 0 },
            });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const createButton = screen.getByRole('button', { name: /create collection/i });
            await user.click(createButton);

            const nameInput = screen.getByPlaceholderText(/collection name/i);
            await user.type(nameInput, 'My New Collection');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(mediaApi.createCollection).toHaveBeenCalledWith({
                    title: 'My New Collection',
                });
            });
        });

        it('should filter by collection', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            // Mock collections in sidebar
            const collectionItem = screen.getByText(/all files/i);
            await user.click(collectionItem);

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        collection: null,
                    })
                );
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            mediaApi.searchMedia.mockRejectedValue(new Error('API Error'));

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/error loading media/i)).toBeInTheDocument();
            });
        });

        it('should show retry option on error', async () => {
            mediaApi.searchMedia.mockRejectedValue(new Error('Network Error'));

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
            });

            const retryButton = screen.getByRole('button', { name: /retry/i });
            await user.click(retryButton);

            expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2);
        });

        it('should handle deletion errors', async () => {
            mediaApi.deleteFile.mockRejectedValue(new Error('Delete failed'));

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const deleteButton = screen.getByTestId('delete-file-btn');
            await user.click(deleteButton);

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(screen.getByText(/delete.*failed/i)).toBeInTheDocument();
            });
        });
    });

    describe('Loading States', () => {
        it('should show loading state initially', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });

        it('should show loading state during operations', async () => {
            // Mock slow API response
            mediaApi.deleteFile.mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100))
            );

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const deleteButton = screen.getByTestId('delete-file-btn');
            await user.click(deleteButton);

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            expect(screen.getByText(/deleting/i)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper page structure', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            expect(screen.getByRole('main')).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        });

        it('should support keyboard navigation', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            // Should be able to navigate with Tab
            await user.tab();
            expect(document.activeElement).toHaveAttribute('role', 'button');
        });

        it('should have accessible labels and descriptions', () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const searchInput = screen.getByLabelText(/search/i);
            expect(searchInput).toBeInTheDocument();

            const fileInput = screen.getByTestId('file-input');
            expect(fileInput).toHaveAttribute('aria-label');
        });

        it('should announce status changes', async () => {
            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const fileInput = screen.getByTestId('file-input');
            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            // Should have aria-live region for status updates
            const statusRegion = screen.getByRole('status');
            expect(statusRegion).toBeInTheDocument();
        });
    });

    describe('Responsive Design', () => {
        it('should adapt layout for mobile screens', () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 768,
            });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            // Should show mobile-optimized layout
            const container = screen.getByRole('main');
            expect(container).toHaveClass('mobile-layout');
        });

        it('should collapse sidebar on small screens', () => {
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 640,
            });

            render(
                <TestWrapper>
                    <MediaManagerPage />
                </TestWrapper>
            );

            const sidebar = screen.getByTestId('collections-sidebar');
            expect(sidebar).toHaveClass('collapsed');
        });
    });
});
