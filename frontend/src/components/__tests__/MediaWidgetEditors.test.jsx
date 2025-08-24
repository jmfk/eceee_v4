/**
 * Tests for Media-Enabled Widget Editors
 * 
 * Tests cover:
 * - ImageEditor with MediaPicker integration
 * - GalleryEditor with multiple media selection
 * - NewsEditor with featured image selection
 * - Widget configuration and validation
 * - MediaPicker integration workflows
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ImageEditor from '../widget-editors/ImageEditor';
import GalleryEditor from '../widget-editors/GalleryEditor';
import NewsEditor from '../widget-editors/NewsEditor';

// Mock MediaPicker component
vi.mock('../media/MediaPicker', () => {
    return function MockMediaPicker({ isOpen, onClose, onSelect, multiple, mediaTypes }) {
        if (!isOpen) return null;

        const mockSingleFile = {
            id: '1',
            title: 'Selected Image',
            file_url: 'https://example.com/selected.jpg',
            file_type: 'image/jpeg',
            thumbnails: {
                small: 'https://example.com/selected_small.jpg',
                medium: 'https://example.com/selected_medium.jpg',
            },
        };

        const mockMultipleFiles = [
            mockSingleFile,
            {
                id: '2',
                title: 'Gallery Image 2',
                file_url: 'https://example.com/gallery2.jpg',
                file_type: 'image/jpeg',
                thumbnails: {
                    small: 'https://example.com/gallery2_small.jpg',
                },
            },
            {
                id: '3',
                title: 'Gallery Image 3',
                file_url: 'https://example.com/gallery3.png',
                file_type: 'image/png',
                thumbnails: {
                    small: 'https://example.com/gallery3_small.jpg',
                },
            },
        ];

        return (
            <div data-testid="media-picker-modal">
                <div data-testid="picker-config">
                    {JSON.stringify({ multiple, mediaTypes })}
                </div>
                <button
                    onClick={() => {
                        onSelect(multiple ? mockMultipleFiles : mockSingleFile);
                        onClose();
                    }}
                    data-testid="select-media-btn"
                >
                    Select {multiple ? 'Multiple' : 'Single'} Media
                </button>
                <button onClick={onClose} data-testid="close-picker-btn">
                    Close
                </button>
            </div>
        );
    };
});

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

describe('ImageEditor', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render with default configuration', () => {
            const mockConfig = {
                image_url: '',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByLabelText(/image source/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/alt text/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/caption/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/link url/i)).toBeInTheDocument();
        });

        it('should show image source selection options', () => {
            const mockConfig = {
                image_url: '',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/media library/i)).toBeInTheDocument();
        });

        it('should display existing image when configured', () => {
            const mockConfig = {
                image_url: 'https://example.com/existing.jpg',
                alt_text: 'Existing image',
                caption: 'Test caption',
                link_url: 'https://example.com',
                media_file_id: '123',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByDisplayValue('https://example.com/existing.jpg')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Existing image')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Test caption')).toBeInTheDocument();
            expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
        });
    });

    describe('Media Library Integration', () => {
        it('should open MediaPicker when selecting from library', async () => {
            const mockConfig = {
                image_url: '',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            // Select media library option
            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            // Click select from library button
            const selectButton = screen.getByRole('button', { name: /select from library/i });
            await user.click(selectButton);

            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });

        it('should configure MediaPicker for single image selection', async () => {
            const mockConfig = {
                image_url: '',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            const selectButton = screen.getByRole('button', { name: /select from library/i });
            await user.click(selectButton);

            const pickerConfig = screen.getByTestId('picker-config');
            const config = JSON.parse(pickerConfig.textContent);

            expect(config.multiple).toBe(false);
            expect(config.mediaTypes).toEqual(['image']);
        });

        it('should update configuration when media is selected', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                image_url: '',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            const selectButton = screen.getByRole('button', { name: /select from library/i });
            await user.click(selectButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            expect(mockOnChange).toHaveBeenCalledWith({
                image_url: 'https://example.com/selected.jpg',
                media_file_id: '1',
                alt_text: '',
                caption: '',
                link_url: '',
            });
        });

        it('should switch between URL and library modes', async () => {
            const mockConfig = {
                image_url: 'https://example.com/url-image.jpg',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            // Should show URL input initially
            expect(screen.getByDisplayValue('https://example.com/url-image.jpg')).toBeInTheDocument();

            // Switch to library mode
            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            // Should hide URL input and show library selection
            expect(screen.queryByDisplayValue('https://example.com/url-image.jpg')).not.toBeVisible();
            expect(screen.getByRole('button', { name: /select from library/i })).toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('should validate required fields', async () => {
            const mockConfig = {
                image_url: '',
                alt_text: '',
                caption: '',
                link_url: '',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            // Alt text should be required for accessibility
            const altTextInput = screen.getByLabelText(/alt text/i);
            expect(altTextInput).toHaveAttribute('required');
        });

        it('should show validation errors', async () => {
            const mockConfig = {
                image_url: 'invalid-url',
                alt_text: '',
                caption: '',
                link_url: 'invalid-link',
            };

            render(
                <TestWrapper>
                    <ImageEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            // Should validate URL format
            const imageUrlInput = screen.getByDisplayValue('invalid-url');
            fireEvent.blur(imageUrlInput);

            await waitFor(() => {
                expect(screen.getByText(/invalid url/i)).toBeInTheDocument();
            });
        });
    });
});

describe('GalleryEditor', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render with default configuration', () => {
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByText(/gallery images/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/layout/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/columns/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/show captions/i)).toBeInTheDocument();
        });

        it('should display existing gallery images', () => {
            const mockConfig = {
                images: [
                    {
                        url: 'https://example.com/gallery1.jpg',
                        alt: 'Gallery Image 1',
                        caption: 'First image',
                        media_file_id: '1',
                    },
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: 'Second image',
                        media_file_id: '2',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Gallery Image 1')).toBeInTheDocument();
            expect(screen.getByText('Gallery Image 2')).toBeInTheDocument();
            expect(screen.getByText('First image')).toBeInTheDocument();
            expect(screen.getByText('Second image')).toBeInTheDocument();
        });

        it('should show add image options', () => {
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByRole('button', { name: /add from library/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /add by url/i })).toBeInTheDocument();
        });
    });

    describe('Bulk Media Selection', () => {
        it('should open MediaPicker for bulk selection', async () => {
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const addFromLibraryButton = screen.getByRole('button', { name: /add from library/i });
            await user.click(addFromLibraryButton);

            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });

        it('should configure MediaPicker for multiple image selection', async () => {
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const addFromLibraryButton = screen.getByRole('button', { name: /add from library/i });
            await user.click(addFromLibraryButton);

            const pickerConfig = screen.getByTestId('picker-config');
            const config = JSON.parse(pickerConfig.textContent);

            expect(config.multiple).toBe(true);
            expect(config.mediaTypes).toEqual(['image']);
        });

        it('should add multiple images to gallery', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const addFromLibraryButton = screen.getByRole('button', { name: /add from library/i });
            await user.click(addFromLibraryButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [
                    {
                        url: 'https://example.com/selected.jpg',
                        alt: 'Selected Image',
                        caption: '',
                        media_file_id: '1',
                    },
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: '',
                        media_file_id: '2',
                    },
                    {
                        url: 'https://example.com/gallery3.png',
                        alt: 'Gallery Image 3',
                        caption: '',
                        media_file_id: '3',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            });
        });

        it('should append to existing images', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [
                    {
                        url: 'https://example.com/existing.jpg',
                        alt: 'Existing Image',
                        caption: 'Existing caption',
                        media_file_id: 'existing',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const addFromLibraryButton = screen.getByRole('button', { name: /add from library/i });
            await user.click(addFromLibraryButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [
                    {
                        url: 'https://example.com/existing.jpg',
                        alt: 'Existing Image',
                        caption: 'Existing caption',
                        media_file_id: 'existing',
                    },
                    {
                        url: 'https://example.com/selected.jpg',
                        alt: 'Selected Image',
                        caption: '',
                        media_file_id: '1',
                    },
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: '',
                        media_file_id: '2',
                    },
                    {
                        url: 'https://example.com/gallery3.png',
                        alt: 'Gallery Image 3',
                        caption: '',
                        media_file_id: '3',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            });
        });
    });

    describe('Individual Image Management', () => {
        it('should allow editing individual image properties', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [
                    {
                        url: 'https://example.com/gallery1.jpg',
                        alt: 'Gallery Image 1',
                        caption: 'First image',
                        media_file_id: '1',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const altTextInput = screen.getByDisplayValue('Gallery Image 1');
            await user.clear(altTextInput);
            await user.type(altTextInput, 'Updated alt text');

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [
                    {
                        url: 'https://example.com/gallery1.jpg',
                        alt: 'Updated alt text',
                        caption: 'First image',
                        media_file_id: '1',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            });
        });

        it('should allow removing individual images', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [
                    {
                        url: 'https://example.com/gallery1.jpg',
                        alt: 'Gallery Image 1',
                        caption: 'First image',
                        media_file_id: '1',
                    },
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: 'Second image',
                        media_file_id: '2',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const removeButtons = screen.getAllByRole('button', { name: /remove/i });
            await user.click(removeButtons[0]);

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: 'Second image',
                        media_file_id: '2',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            });
        });

        it('should allow reordering images', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [
                    {
                        url: 'https://example.com/gallery1.jpg',
                        alt: 'Gallery Image 1',
                        caption: 'First image',
                        media_file_id: '1',
                    },
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: 'Second image',
                        media_file_id: '2',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const moveDownButtons = screen.getAllByRole('button', { name: /move down/i });
            await user.click(moveDownButtons[0]);

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [
                    {
                        url: 'https://example.com/gallery2.jpg',
                        alt: 'Gallery Image 2',
                        caption: 'Second image',
                        media_file_id: '2',
                    },
                    {
                        url: 'https://example.com/gallery1.jpg',
                        alt: 'Gallery Image 1',
                        caption: 'First image',
                        media_file_id: '1',
                    },
                ],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            });
        });
    });

    describe('Gallery Settings', () => {
        it('should update layout settings', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const layoutSelect = screen.getByLabelText(/layout/i);
            await user.selectOptions(layoutSelect, 'masonry');

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [],
                layout: 'masonry',
                columns: 3,
                show_captions: true,
            });
        });

        it('should update column count', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                images: [],
                layout: 'grid',
                columns: 3,
                show_captions: true,
            };

            render(
                <TestWrapper>
                    <GalleryEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const columnsInput = screen.getByLabelText(/columns/i);
            await user.clear(columnsInput);
            await user.type(columnsInput, '4');

            expect(mockOnChange).toHaveBeenCalledWith({
                images: [],
                layout: 'grid',
                columns: 4,
                show_captions: true,
            });
        });
    });
});

describe('NewsEditor', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render with default configuration', () => {
            const mockConfig = {
                title: '',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/publish date/i)).toBeInTheDocument();
            expect(screen.getByText(/featured image/i)).toBeInTheDocument();
        });

        it('should display existing news configuration', () => {
            const mockConfig = {
                title: 'Breaking News',
                content: 'This is the news content.',
                author: 'John Doe',
                publishDate: '2024-01-15',
                featuredImage: {
                    url: 'https://example.com/news.jpg',
                    alt: 'News image',
                    media_file_id: '123',
                },
                tags: ['breaking', 'news'],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByDisplayValue('Breaking News')).toBeInTheDocument();
            expect(screen.getByDisplayValue('This is the news content.')).toBeInTheDocument();
            expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
            expect(screen.getByDisplayValue('2024-01-15')).toBeInTheDocument();
        });
    });

    describe('Featured Image Selection', () => {
        it('should show image source options', () => {
            const mockConfig = {
                title: '',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/media library/i)).toBeInTheDocument();
        });

        it('should open MediaPicker when selecting from library', async () => {
            const mockConfig = {
                title: '',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            const selectButton = screen.getByRole('button', { name: /select from library/i });
            await user.click(selectButton);

            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });

        it('should configure MediaPicker for single image selection', async () => {
            const mockConfig = {
                title: '',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            const selectButton = screen.getByRole('button', { name: /select from library/i });
            await user.click(selectButton);

            const pickerConfig = screen.getByTestId('picker-config');
            const config = JSON.parse(pickerConfig.textContent);

            expect(config.multiple).toBe(false);
            expect(config.mediaTypes).toEqual(['image']);
        });

        it('should update featured image when media is selected', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                title: 'Test News',
                content: 'Test content',
                author: 'Test Author',
                publishDate: '2024-01-15',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const libraryRadio = screen.getByLabelText(/media library/i);
            await user.click(libraryRadio);

            const selectButton = screen.getByRole('button', { name: /select from library/i });
            await user.click(selectButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            expect(mockOnChange).toHaveBeenCalledWith({
                title: 'Test News',
                content: 'Test content',
                author: 'Test Author',
                publishDate: '2024-01-15',
                featuredImage: {
                    url: 'https://example.com/selected.jpg',
                    alt: 'Selected Image',
                    media_file_id: '1',
                },
                tags: [],
            });
        });

        it('should allow removing featured image', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                title: 'Test News',
                content: 'Test content',
                author: 'Test Author',
                publishDate: '2024-01-15',
                featuredImage: {
                    url: 'https://example.com/existing.jpg',
                    alt: 'Existing image',
                    media_file_id: '123',
                },
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const removeButton = screen.getByRole('button', { name: /remove.*image/i });
            await user.click(removeButton);

            expect(mockOnChange).toHaveBeenCalledWith({
                title: 'Test News',
                content: 'Test content',
                author: 'Test Author',
                publishDate: '2024-01-15',
                featuredImage: null,
                tags: [],
            });
        });
    });

    describe('Form Validation', () => {
        it('should validate required fields', () => {
            const mockConfig = {
                title: '',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={vi.fn()}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const titleInput = screen.getByLabelText(/title/i);
            const contentInput = screen.getByLabelText(/content/i);

            expect(titleInput).toHaveAttribute('required');
            expect(contentInput).toHaveAttribute('required');
        });

        it('should update configuration when fields change', async () => {
            const mockOnChange = vi.fn();
            const mockConfig = {
                title: '',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            };

            render(
                <TestWrapper>
                    <NewsEditor
                        config={mockConfig}
                        onChange={mockOnChange}
                        namespace="test-namespace"
                    />
                </TestWrapper>
            );

            const titleInput = screen.getByLabelText(/title/i);
            await user.type(titleInput, 'New Article Title');

            expect(mockOnChange).toHaveBeenCalledWith({
                title: 'New Article Title',
                content: '',
                author: '',
                publishDate: '',
                featuredImage: null,
                tags: [],
            });
        });
    });
});
