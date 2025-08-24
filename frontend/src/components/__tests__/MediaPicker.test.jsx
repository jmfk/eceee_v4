/**
 * Tests for MediaPicker Component
 * 
 * Tests cover:
 * - Component rendering and props handling
 * - File selection (single and multiple)
 * - Search and filtering functionality
 * - Upload functionality and progress
 * - Error handling and validation
 * - Accessibility compliance
 * - Integration with MediaBrowser
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MediaPicker from '../media/MediaPicker';
import * as mediaApi from '../../api/media';

// Mock the media API
vi.mock('../../api/media', () => ({
    default: {
        searchMedia: vi.fn(),
        uploadFile: vi.fn(),
        getMediaCollections: vi.fn(),
        getMediaTags: vi.fn(),
    },
    searchMedia: vi.fn(),
    uploadFile: vi.fn(),
    getMediaCollections: vi.fn(),
    getMediaTags: vi.fn(),
}));

// Mock MediaBrowser component
vi.mock('../media/MediaBrowser', () => {
    return function MockMediaBrowser({ onSelect, multiple, mediaTypes, namespace }) {
        return (
            <div data-testid="media-browser">
                <div data-testid="browser-props">
                    {JSON.stringify({ multiple, mediaTypes, namespace })}
                </div>
                <button
                    onClick={() => onSelect(multiple ? [mockMediaFile, mockMediaFile2] : mockMediaFile)}
                    data-testid="select-media-btn"
                >
                    Select Media
                </button>
            </div>
        );
    };
});

// Test data
const mockMediaFile = {
    id: '1',
    title: 'Test Image',
    file_url: 'https://example.com/test.jpg',
    file_type: 'image/jpeg',
    file_size: 1024000,
    thumbnails: {
        small: 'https://example.com/test_small.jpg',
        medium: 'https://example.com/test_medium.jpg',
    },
};

const mockMediaFile2 = {
    id: '2',
    title: 'Test Image 2',
    file_url: 'https://example.com/test2.jpg',
    file_type: 'image/png',
    file_size: 2048000,
    thumbnails: {
        small: 'https://example.com/test2_small.jpg',
        medium: 'https://example.com/test2_medium.jpg',
    },
};

const mockUploadResponse = {
    id: '3',
    title: 'Uploaded Image',
    file_url: 'https://example.com/uploaded.jpg',
    file_type: 'image/jpeg',
    file_size: 512000,
};

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
            {children}
        </QueryClientProvider>
    );
}

describe('MediaPicker', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();

        // Setup default API mocks
        mediaApi.searchMedia.mockResolvedValue({
            data: {
                results: [mockMediaFile, mockMediaFile2],
                count: 2,
            },
        });

        mediaApi.uploadFile.mockResolvedValue({
            data: mockUploadResponse,
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
        it('should render correctly with default props', () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                    />
                </TestWrapper>
            );

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Select Media')).toBeInTheDocument();
            expect(screen.getByTestId('media-browser')).toBeInTheDocument();
        });

        it('should not render when isOpen is false', () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={false}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                    />
                </TestWrapper>
            );

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should pass correct props to MediaBrowser', () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        multiple={true}
                        mediaTypes={['image']}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const browserProps = screen.getByTestId('browser-props');
            const props = JSON.parse(browserProps.textContent);

            expect(props.multiple).toBe(true);
            expect(props.mediaTypes).toEqual(['image']);
            expect(props.namespace).toBe('test-namespace');
        });
    });

    describe('Media Selection', () => {
        it('should handle single file selection', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        multiple={false}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-media-btn');
            await user.click(selectButton);

            expect(mockOnSelect).toHaveBeenCalledWith(mockMediaFile);
        });

        it('should handle multiple file selection', async () => {
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

            const selectButton = screen.getByTestId('select-media-btn');
            await user.click(selectButton);

            expect(mockOnSelect).toHaveBeenCalledWith([mockMediaFile, mockMediaFile2]);
        });

        it('should close modal after selection', async () => {
            const mockOnClose = vi.fn();
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={mockOnClose}
                        onSelect={mockOnSelect}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByTestId('select-media-btn');
            await user.click(selectButton);

            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    describe('File Upload', () => {
        it('should show upload area when enabled', () => {
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

            expect(screen.getByText(/drag.*drop.*files/i)).toBeInTheDocument();
            expect(screen.getByText(/browse files/i)).toBeInTheDocument();
        });

        it('should handle file upload via drag and drop', async () => {
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

            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
            const dropZone = screen.getByText(/drag.*drop.*files/i).closest('div');

            fireEvent.dragOver(dropZone);
            fireEvent.drop(dropZone, {
                dataTransfer: {
                    files: [file],
                },
            });

            await waitFor(() => {
                expect(mediaApi.uploadFile).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file,
                    })
                );
            });

            await waitFor(() => {
                expect(mockOnSelect).toHaveBeenCalledWith(mockUploadResponse);
            });
        });

        it('should handle file upload via file input', async () => {
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

            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/browse files/i);

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(mediaApi.uploadFile).toHaveBeenCalledWith(
                    expect.objectContaining({
                        file,
                    })
                );
            });

            await waitFor(() => {
                expect(mockOnSelect).toHaveBeenCalledWith(mockUploadResponse);
            });
        });

        it('should show upload progress', async () => {
            // Mock upload with delay to test progress
            mediaApi.uploadFile.mockImplementation(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: mockUploadResponse }), 100)
                )
            );

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

            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/browse files/i);

            await user.upload(fileInput, file);

            // Should show uploading state
            expect(screen.getByText(/uploading/i)).toBeInTheDocument();

            // Wait for upload to complete
            await waitFor(() => {
                expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
            });
        });

        it('should handle upload errors', async () => {
            const uploadError = new Error('Upload failed');
            mediaApi.uploadFile.mockRejectedValue(uploadError);

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

            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/browse files/i);

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
            });
        });

        it('should validate file types', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                        allowUpload={true}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            const invalidFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
            const fileInput = screen.getByLabelText(/browse files/i);

            await user.upload(fileInput, invalidFile);

            expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
            expect(mediaApi.uploadFile).not.toHaveBeenCalled();
        });

        it('should validate file size limits', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                        allowUpload={true}
                        maxFileSize={1024} // 1KB limit
                    />
                </TestWrapper>
            );

            const largeFile = new File(['x'.repeat(2048)], 'large.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/browse files/i);

            await user.upload(fileInput, largeFile);

            expect(screen.getByText(/file too large/i)).toBeInTheDocument();
            expect(mediaApi.uploadFile).not.toHaveBeenCalled();
        });
    });

    describe('Modal Behavior', () => {
        it('should close modal when clicking close button', async () => {
            const mockOnClose = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={mockOnClose}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            const closeButton = screen.getByRole('button', { name: /close/i });
            await user.click(closeButton);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should close modal when clicking overlay', async () => {
            const mockOnClose = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={mockOnClose}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            const overlay = screen.getByRole('dialog').parentElement;
            await user.click(overlay);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should close modal when pressing Escape key', async () => {
            const mockOnClose = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={mockOnClose}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            await user.keyboard('{Escape}');

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should trap focus within modal', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            const modal = screen.getByRole('dialog');
            const focusableElements = within(modal).getAllByRole('button');

            // Focus should be trapped within modal
            expect(document.activeElement).toBe(focusableElements[0]);

            // Tab should cycle through focusable elements
            await user.tab();
            expect(focusableElements).toContain(document.activeElement);
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA attributes', () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby');
        });

        it('should have accessible labels for form controls', () => {
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
            expect(fileInput).toBeInTheDocument();
            expect(fileInput).toHaveAttribute('type', 'file');
        });

        it('should announce upload status to screen readers', async () => {
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

            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/browse files/i);

            await user.upload(fileInput, file);

            // Should have aria-live region for status updates
            const statusRegion = screen.getByRole('status');
            expect(statusRegion).toBeInTheDocument();
        });

        it('should support keyboard navigation', async () => {
            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={vi.fn()}
                    />
                </TestWrapper>
            );

            // Should be able to navigate with keyboard
            await user.tab();
            expect(document.activeElement).toHaveAttribute('role', 'button');

            await user.keyboard('{Enter}');
            // Should trigger button action
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            mediaApi.searchMedia.mockRejectedValue(new Error('API Error'));

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
                expect(screen.getByText(/error loading media/i)).toBeInTheDocument();
            });
        });

        it('should show retry option on error', async () => {
            mediaApi.searchMedia.mockRejectedValue(new Error('Network Error'));

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
                expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
            });
        });

        it('should handle empty media library', async () => {
            mediaApi.searchMedia.mockResolvedValue({
                data: {
                    results: [],
                    count: 0,
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
                expect(screen.getByText(/no media files found/i)).toBeInTheDocument();
            });
        });
    });

    describe('Integration', () => {
        it('should work with different namespace configurations', () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        namespace="custom-namespace"
                    />
                </TestWrapper>
            );

            const browserProps = screen.getByTestId('browser-props');
            const props = JSON.parse(browserProps.textContent);

            expect(props.namespace).toBe('custom-namespace');
        });

        it('should filter by media types correctly', () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        mediaTypes={['image', 'video']}
                    />
                </TestWrapper>
            );

            const browserProps = screen.getByTestId('browser-props');
            const props = JSON.parse(browserProps.textContent);

            expect(props.mediaTypes).toEqual(['image', 'video']);
        });

        it('should handle selection limits for multiple selection', async () => {
            const mockOnSelect = vi.fn();

            render(
                <TestWrapper>
                    <MediaPicker
                        isOpen={true}
                        onClose={vi.fn()}
                        onSelect={mockOnSelect}
                        multiple={true}
                        maxItems={1}
                    />
                </TestWrapper>
            );

            // Should show selection limit in UI
            expect(screen.getByText(/maximum.*1.*file/i)).toBeInTheDocument();
        });
    });
});
