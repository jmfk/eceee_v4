/**
 * Integration Tests for Media System
 * 
 * Tests cover:
 * - Complete media selection workflows
 * - Integration between components
 * - End-to-end user scenarios
 * - Cross-component state management
 * - Real API integration patterns
 * - Error recovery workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Import actual components for integration testing
import MediaPicker from '../media/MediaPicker';
import MediaBrowser from '../media/MediaBrowser';
import MediaField from '../form-fields/MediaField';
import SchemaDrivenForm from '../SchemaDrivenForm';
import PageEditor from '../PageEditor';
import * as mediaApi from '../../api/media';

// Mock API calls but use real component interactions
vi.mock('../../api/media', () => ({
    searchMedia: vi.fn(),
    uploadFile: vi.fn(),
    getMediaCollections: vi.fn(),
    getMediaTags: vi.fn(),
    createCollection: vi.fn(),
    addToCollection: vi.fn(),
    deleteFile: vi.fn(),
}));

// Mock router hooks
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: () => ({ pageId: '123' }),
        useNavigate: () => vi.fn(),
    };
});

// Test data
const mockMediaFiles = [
    {
        id: '1',
        title: 'Hero Image',
        file_url: 'https://example.com/hero.jpg',
        file_type: 'image/jpeg',
        file_size: 2048000,
        created_at: '2024-01-01T10:00:00Z',
        tags: ['hero', 'banner'],
        thumbnails: {
            small: 'https://example.com/hero_small.jpg',
            medium: 'https://example.com/hero_medium.jpg',
            large: 'https://example.com/hero_large.jpg',
        },
    },
    {
        id: '2',
        title: 'Gallery Photo 1',
        file_url: 'https://example.com/gallery1.jpg',
        file_type: 'image/jpeg',
        file_size: 1536000,
        created_at: '2024-01-02T10:00:00Z',
        tags: ['gallery', 'nature'],
        thumbnails: {
            small: 'https://example.com/gallery1_small.jpg',
            medium: 'https://example.com/gallery1_medium.jpg',
        },
    },
    {
        id: '3',
        title: 'Gallery Photo 2',
        file_url: 'https://example.com/gallery2.jpg',
        file_type: 'image/jpeg',
        file_size: 1792000,
        created_at: '2024-01-03T10:00:00Z',
        tags: ['gallery', 'landscape'],
        thumbnails: {
            small: 'https://example.com/gallery2_small.jpg',
            medium: 'https://example.com/gallery2_medium.jpg',
        },
    },
];

const mockCollections = [
    { id: '1', title: 'Hero Images', file_count: 5 },
    { id: '2', title: 'Gallery Photos', file_count: 12 },
];

const mockTags = [
    { id: '1', name: 'hero', usage_count: 5 },
    { id: '2', name: 'gallery', usage_count: 15 },
    { id: '3', name: 'nature', usage_count: 8 },
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

describe('Media System Integration', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();

        // Setup comprehensive API mocks
        mediaApi.searchMedia.mockResolvedValue({
            data: {
                results: mockMediaFiles,
                count: 3,
                next: null,
                previous: null,
            },
        });

        mediaApi.getMediaCollections.mockResolvedValue({
            data: { results: mockCollections },
        });

        mediaApi.getMediaTags.mockResolvedValue({
            data: { results: mockTags },
        });

        mediaApi.uploadFile.mockResolvedValue({
            data: {
                id: 'uploaded-1',
                title: 'Uploaded Image',
                file_url: 'https://example.com/uploaded.jpg',
                file_type: 'image/jpeg',
                thumbnails: {
                    small: 'https://example.com/uploaded_small.jpg',
                },
            },
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('MediaPicker + MediaBrowser Integration', () => {
        it('should complete full media selection workflow', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        multiple={false}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            // Wait for MediaBrowser to load
            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            // Select a media file
            const heroImage = screen.getByText('Hero Image').closest('[data-testid="media-file"]');
            await user.click(heroImage);

            // Should call onSelect with the selected file
            expect(mockOnSelect).toHaveBeenCalledWith(mockMediaFiles[0]);
        });

        it('should handle multiple selection workflow', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        multiple={true}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Gallery Photo 1')).toBeInTheDocument();
            });

            // Select multiple files
            const photo1 = screen.getByText('Gallery Photo 1').closest('[data-testid="media-file"]');
            const photo2 = screen.getByText('Gallery Photo 2').closest('[data-testid="media-file"]');

            await user.click(photo1);
            await user.click(photo2);

            // Should show selection count
            expect(screen.getByText('2 selected')).toBeInTheDocument();

            // Confirm selection
            const confirmButton = screen.getByRole('button', { name: /confirm selection/i });
            await user.click(confirmButton);

            expect(mockOnSelect).toHaveBeenCalledWith([mockMediaFiles[1], mockMediaFiles[2]]);
        });

        it('should filter media by type correctly', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file_type: 'image',
                    })
                );
            });
        });

        it('should handle search and filtering integration', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            // Use search functionality
            const searchInput = screen.getByPlaceholderText(/search media/i);
            await user.type(searchInput, 'gallery');

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        search: 'gallery',
                    })
                );
            });

            // Filter by tags
            const galleryTag = screen.getByText('gallery');
            await user.click(galleryTag);

            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tags: 'gallery',
                    })
                );
            });
        });
    });

    describe('MediaField + MediaPicker Integration', () => {
        it('should integrate with schema-driven forms', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Featured Image"
                        value={null}
                        onChange={mockOnChange}
                        multiple={false}
                        mediaTypes={['image']}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            // Open MediaPicker
            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            // Wait for picker to load
            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Select media
            const heroImage = screen.getByText('Hero Image').closest('[data-testid="media-file"]');
            await user.click(heroImage);

            // Should update field value
            expect(mockOnChange).toHaveBeenCalledWith(mockMediaFiles[0]);

            // Should close picker
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should handle multiple media field integration', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Gallery Images"
                        value={[]}
                        onChange={mockOnChange}
                        multiple={true}
                        mediaTypes={['image']}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Select multiple images
            const photo1 = screen.getByText('Gallery Photo 1').closest('[data-testid="media-file"]');
            const photo2 = screen.getByText('Gallery Photo 2').closest('[data-testid="media-file"]');

            await user.click(photo1);
            await user.click(photo2);

            const confirmButton = screen.getByRole('button', { name: /confirm selection/i });
            await user.click(confirmButton);

            expect(mockOnChange).toHaveBeenCalledWith([mockMediaFiles[1], mockMediaFiles[2]]);
        });

        it('should preserve field state during form updates', async () => {
            const { rerender } = render(
                <TestWrapper>
                    <MediaField
                        label="Persistent Field"
                        value={mockMediaFiles[0]}
                        onChange={vi.fn()}
                        multiple={false}
                    />
                </TestWrapper>
            );

            // Should display selected media
            expect(screen.getByText('Hero Image')).toBeInTheDocument();

            // Rerender with same value
            rerender(
                <TestWrapper>
                    <MediaField
                        label="Persistent Field"
                        value={mockMediaFiles[0]}
                        onChange={vi.fn()}
                        multiple={false}
                    />
                </TestWrapper>
            );

            // Should maintain display
            expect(screen.getByText('Hero Image')).toBeInTheDocument();
        });
    });

    describe('Upload Integration Workflow', () => {
        it('should handle complete upload and selection workflow', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        allowUpload={true}
                    />
                </TestWrapper>
            );

            // Upload a new file
            const fileInput = screen.getByLabelText(/browse files/i);
            const file = new File(['test content'], 'new-image.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            // Should show upload progress
            expect(screen.getByText(/uploading/i)).toBeInTheDocument();

            // Wait for upload to complete
            await waitFor(() => {
                expect(mediaApi.uploadFile).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file,
                    })
                );
            });

            // Should auto-select uploaded file
            expect(mockOnSelect).toHaveBeenCalledWith({
                id: 'uploaded-1',
                title: 'Uploaded Image',
                file_url: 'https://example.com/uploaded.jpg',
                file_type: 'image/jpeg',
                thumbnails: {
                    small: 'https://example.com/uploaded_small.jpg',
                },
            });
        });

        it('should refresh media list after upload', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                        allowUpload={true}
                    />
                </TestWrapper>
            );

            const fileInput = screen.getByLabelText(/browse files/i);
            const file = new File(['test content'], 'new-image.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            await waitFor(() => {
                // Should call searchMedia again to refresh the list
                expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2); // Initial + refresh
            });
        });

        it('should handle upload errors gracefully', async () => {
            mediaApi.uploadFile.mockRejectedValue(new Error('Upload failed'));

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                        allowUpload={true}
                    />
                </TestWrapper>
            );

            const fileInput = screen.getByLabelText(/browse files/i);
            const file = new File(['test content'], 'error-image.jpg', { type: 'image/jpeg' });

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
            });

            // Should show retry option
            expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });
    });

    describe('Error Recovery Workflows', () => {
        it('should handle API errors and allow retry', async () => {
            // First call fails, second succeeds
            mediaApi.searchMedia
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    data: {
                        results: mockMediaFiles,
                        count: 3,
                        next: null,
                        previous: null,
                    },
                });

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            // Should show error state
            await waitFor(() => {
                expect(screen.getByText(/error loading media/i)).toBeInTheDocument();
            });

            // Retry should work
            const retryButton = screen.getByRole('button', { name: /retry/i });
            await user.click(retryButton);

            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2);
        });

        it('should handle partial failures gracefully', async () => {
            // Mock successful media load but failed collections
            mediaApi.getMediaCollections.mockRejectedValue(new Error('Collections failed'));

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            // Should still show media files
            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            // Should show collections error but not block main functionality
            expect(screen.getByText(/collections unavailable/i)).toBeInTheDocument();
        });

        it('should maintain selection state during errors', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        multiple={true}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Gallery Photo 1')).toBeInTheDocument();
            });

            // Select files
            const photo1 = screen.getByText('Gallery Photo 1').closest('[data-testid="media-file"]');
            await user.click(photo1);

            expect(screen.getByText('1 selected')).toBeInTheDocument();

            // Simulate API error during additional operations
            mediaApi.searchMedia.mockRejectedValue(new Error('Search failed'));

            // Try to search (which will fail)
            const searchInput = screen.getByPlaceholderText(/search media/i);
            await user.type(searchInput, 'test');

            // Selection should be preserved
            expect(screen.getByText('1 selected')).toBeInTheDocument();
        });
    });

    describe('Performance and Optimization', () => {
        it('should handle large media libraries efficiently', async () => {
            const manyFiles = Array.from({ length: 100 }, (_, i) => ({
                ...mockMediaFiles[0],
                id: `file-${i}`,
                title: `Image ${i}`,
            }));

            mediaApi.searchMedia.mockResolvedValue({
                data: {
                    results: manyFiles.slice(0, 20), // Paginated
                    count: 100,
                    next: 'http://api.example.com/media/?page=2',
                    previous: null,
                },
            });

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                // Should only render first page
                const renderedFiles = screen.getAllByTestId('media-file');
                expect(renderedFiles.length).toBeLessThanOrEqual(20);
            });

            // Should show pagination or infinite scroll
            expect(screen.getByText(/1.*of.*5/)).toBeInTheDocument(); // Page indicator
        });

        it('should debounce search input for performance', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText(/search media/i);

            // Type quickly
            await user.type(searchInput, 'quick typing test');

            // Should debounce and only make final API call
            await waitFor(() => {
                expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2); // Initial + final search
            });
        });

        it('should cache API responses appropriately', async () => {
            const { rerender } = render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            // Close and reopen picker
            rerender(
                <TestWrapper>
                    <MediaPicker
                        isOpen={false}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            rerender(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            // Should use cached data (React Query caching)
            expect(screen.getByText('Hero Image')).toBeInTheDocument();
            expect(mediaApi.searchMedia).toHaveBeenCalledTimes(1); // Only initial call
        });
    });

    describe('Accessibility Integration', () => {
        it('should maintain focus management across components', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            // Focus should be trapped within modal
            const modal = screen.getByRole('dialog');
            const focusableElements = within(modal).getAllByRole('button');

            // Tab should cycle through focusable elements
            await user.tab();
            expect(focusableElements).toContain(document.activeElement);

            await user.tab();
            expect(focusableElements).toContain(document.activeElement);
        });

        it('should announce state changes to screen readers', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                        multiple={true}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Gallery Photo 1')).toBeInTheDocument();
            });

            // Select a file
            const photo1 = screen.getByText('Gallery Photo 1').closest('[data-testid="media-file"]');
            await user.click(photo1);

            // Should announce selection change
            const statusRegion = screen.getByRole('status');
            expect(statusRegion).toHaveTextContent(/1.*selected/i);
        });

        it('should support keyboard-only navigation', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Hero Image')).toBeInTheDocument();
            });

            // Should be able to navigate and select with keyboard
            const firstFile = screen.getByText('Hero Image').closest('[data-testid="media-file"]');
            firstFile.focus();

            await user.keyboard('{Enter}');

            // Should trigger selection
            expect(firstFile).toHaveAttribute('aria-selected', 'true');
        });
    });
});
