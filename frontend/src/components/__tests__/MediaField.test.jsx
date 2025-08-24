/**
 * Tests for MediaField Component
 * 
 * Tests cover:
 * - Schema-driven form integration
 * - Single and multiple media selection
 * - Media type filtering (images, videos, documents)
 * - Validation and error handling
 * - MediaPicker integration
 * - Value formatting and display
 * - Accessibility compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MediaField from '../form-fields/MediaField';

// Mock MediaPicker component
vi.mock('../media/MediaPicker', () => {
    return function MockMediaPicker({ isOpen, onClose, onSelect, multiple, mediaTypes }) {
        if (!isOpen) return null;

        return (
            <div data-testid="media-picker-modal">
                <div data-testid="picker-props">
                    {JSON.stringify({ multiple, mediaTypes })}
                </div>
                <button
                    onClick={() => {
                        const mockFile = {
                            id: '1',
                            title: 'Test Image',
                            file_url: 'https://example.com/test.jpg',
                            file_type: 'image/jpeg',
                            thumbnails: {
                                small: 'https://example.com/test_small.jpg',
                            },
                        };
                        const mockFile2 = {
                            id: '2',
                            title: 'Test Video',
                            file_url: 'https://example.com/test.mp4',
                            file_type: 'video/mp4',
                            thumbnails: {
                                small: 'https://example.com/test_video_small.jpg',
                            },
                        };

                        onSelect(multiple ? [mockFile, mockFile2] : mockFile);
                        onClose();
                    }}
                    data-testid="select-media-btn"
                >
                    Select Media
                </button>
                <button onClick={onClose} data-testid="close-picker-btn">
                    Close
                </button>
            </div>
        );
    };
});

// Test data
const mockSingleMediaValue = {
    id: '1',
    title: 'Existing Image',
    file_url: 'https://example.com/existing.jpg',
    file_type: 'image/jpeg',
    thumbnails: {
        small: 'https://example.com/existing_small.jpg',
        medium: 'https://example.com/existing_medium.jpg',
    },
};

const mockMultipleMediaValue = [
    {
        id: '1',
        title: 'Image 1',
        file_url: 'https://example.com/image1.jpg',
        file_type: 'image/jpeg',
        thumbnails: {
            small: 'https://example.com/image1_small.jpg',
        },
    },
    {
        id: '2',
        title: 'Image 2',
        file_url: 'https://example.com/image2.png',
        file_type: 'image/png',
        thumbnails: {
            small: 'https://example.com/image2_small.jpg',
        },
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
            {children}
        </QueryClientProvider>
    );
}

describe('MediaField', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render with label and description', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Featured Image"
                        description="Select an image for the featured content"
                        value={null}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Featured Image')).toBeInTheDocument();
            expect(screen.getByText('Select an image for the featured content')).toBeInTheDocument();
        });

        it('should show required indicator when required', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Required Media"
                        value={null}
                        onChange={vi.fn()}
                        required={true}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('*')).toBeInTheDocument();
        });

        it('should render select button when no value', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Media Field"
                        value={null}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            expect(screen.getByRole('button', { name: /select media/i })).toBeInTheDocument();
        });

        it('should show placeholder text when no value', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Media Field"
                        value={null}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            expect(screen.getByText(/no media selected/i)).toBeInTheDocument();
        });
    });

    describe('Single Media Selection', () => {
        it('should display selected media file', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Single Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                        multiple={false}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Existing Image')).toBeInTheDocument();
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/existing_small.jpg');
        });

        it('should open MediaPicker when clicking select button', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Single Media"
                        value={null}
                        onChange={vi.fn()}
                        multiple={false}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });

        it('should pass correct props to MediaPicker for single selection', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Image Field"
                        value={null}
                        onChange={vi.fn()}
                        multiple={false}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            const pickerProps = screen.getByTestId('picker-props');
            const props = JSON.parse(pickerProps.textContent);

            expect(props.multiple).toBe(false);
            expect(props.mediaTypes).toEqual(['image']);
        });

        it('should update value when media is selected', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Single Media"
                        value={null}
                        onChange={mockOnChange}
                        multiple={false}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            expect(mockOnChange).toHaveBeenCalledWith({
                id: '1',
                title: 'Test Image',
                file_url: 'https://example.com/test.jpg',
                file_type: 'image/jpeg',
                thumbnails: {
                    small: 'https://example.com/test_small.jpg',
                },
            });
        });

        it('should show change and remove buttons when media is selected', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Single Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                        multiple={false}
                    />
                </TestWrapper>
            );

            expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
        });

        it('should remove media when clicking remove button', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Single Media"
                        value={mockSingleMediaValue}
                        onChange={mockOnChange}
                        multiple={false}
                    />
                </TestWrapper>
            );

            const removeButton = screen.getByRole('button', { name: /remove/i });
            await user.click(removeButton);

            expect(mockOnChange).toHaveBeenCalledWith(null);
        });

        it('should open MediaPicker when clicking change button', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Single Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                        multiple={false}
                    />
                </TestWrapper>
            );

            const changeButton = screen.getByRole('button', { name: /change/i });
            await user.click(changeButton);

            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });
    });

    describe('Multiple Media Selection', () => {
        it('should display multiple selected media files', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Multiple Media"
                        value={mockMultipleMediaValue}
                        onChange={vi.fn()}
                        multiple={true}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Image 1')).toBeInTheDocument();
            expect(screen.getByText('Image 2')).toBeInTheDocument();
            expect(screen.getAllByRole('img')).toHaveLength(2);
        });

        it('should show count of selected items', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Multiple Media"
                        value={mockMultipleMediaValue}
                        onChange={vi.fn()}
                        multiple={true}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('2 files selected')).toBeInTheDocument();
        });

        it('should pass correct props to MediaPicker for multiple selection', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Gallery Field"
                        value={[]}
                        onChange={vi.fn()}
                        multiple={true}
                        mediaTypes={['image', 'video']}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            const pickerProps = screen.getByTestId('picker-props');
            const props = JSON.parse(pickerProps.textContent);

            expect(props.multiple).toBe(true);
            expect(props.mediaTypes).toEqual(['image', 'video']);
        });

        it('should update value when multiple media are selected', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Multiple Media"
                        value={[]}
                        onChange={mockOnChange}
                        multiple={true}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            expect(mockOnChange).toHaveBeenCalledWith([
                {
                    id: '1',
                    title: 'Test Image',
                    file_url: 'https://example.com/test.jpg',
                    file_type: 'image/jpeg',
                    thumbnails: {
                        small: 'https://example.com/test_small.jpg',
                    },
                },
                {
                    id: '2',
                    title: 'Test Video',
                    file_url: 'https://example.com/test.mp4',
                    file_type: 'video/mp4',
                    thumbnails: {
                        small: 'https://example.com/test_video_small.jpg',
                    },
                },
            ]);
        });

        it('should remove individual items from multiple selection', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Multiple Media"
                        value={mockMultipleMediaValue}
                        onChange={mockOnChange}
                        multiple={true}
                    />
                </TestWrapper>
            );

            const removeButtons = screen.getAllByRole('button', { name: /remove.*image/i });
            await user.click(removeButtons[0]);

            expect(mockOnChange).toHaveBeenCalledWith([mockMultipleMediaValue[1]]);
        });

        it('should clear all items when clicking clear all button', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Multiple Media"
                        value={mockMultipleMediaValue}
                        onChange={mockOnChange}
                        multiple={true}
                    />
                </TestWrapper>
            );

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            expect(mockOnChange).toHaveBeenCalledWith([]);
        });

        it('should enforce maximum item limits', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Limited Media"
                        value={mockMultipleMediaValue}
                        onChange={vi.fn()}
                        multiple={true}
                        maxItems={1}
                    />
                </TestWrapper>
            );

            expect(screen.getByText(/maximum.*1.*file/i)).toBeInTheDocument();
        });

        it('should enforce minimum item requirements', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Required Media"
                        value={[]}
                        onChange={vi.fn()}
                        multiple={true}
                        minItems={2}
                        validation={{ hasError: true, message: 'At least 2 files required' }}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('At least 2 files required')).toBeInTheDocument();
        });
    });

    describe('Media Type Filtering', () => {
        it('should show appropriate icons for different media types', () => {
            const mixedMediaValue = [
                {
                    id: '1',
                    title: 'Test Image',
                    file_url: 'https://example.com/test.jpg',
                    file_type: 'image/jpeg',
                    thumbnails: { small: 'https://example.com/test_small.jpg' },
                },
                {
                    id: '2',
                    title: 'Test Video',
                    file_url: 'https://example.com/test.mp4',
                    file_type: 'video/mp4',
                    thumbnails: {},
                },
                {
                    id: '3',
                    title: 'Test Document',
                    file_url: 'https://example.com/test.pdf',
                    file_type: 'application/pdf',
                    thumbnails: {},
                },
            ];

            render(
                <TestWrapper>
                    <MediaField
                        label="Mixed Media"
                        value={mixedMediaValue}
                        onChange={vi.fn()}
                        multiple={true}
                    />
                </TestWrapper>
            );

            // Should show image thumbnail
            expect(screen.getByRole('img')).toBeInTheDocument();

            // Should show video and document icons
            expect(screen.getByTestId('video-icon')).toBeInTheDocument();
            expect(screen.getByTestId('document-icon')).toBeInTheDocument();
        });

        it('should filter by image types only', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Images Only"
                        value={null}
                        onChange={vi.fn()}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            const pickerProps = screen.getByTestId('picker-props');
            const props = JSON.parse(pickerProps.textContent);

            expect(props.mediaTypes).toEqual(['image']);
        });

        it('should show media type hint in placeholder', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Images Only"
                        value={null}
                        onChange={vi.fn()}
                        mediaTypes={['image']}
                    />
                </TestWrapper>
            );

            expect(screen.getByText(/select.*image/i)).toBeInTheDocument();
        });
    });

    describe('Validation and Error Handling', () => {
        it('should display validation errors', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Required Media"
                        value={null}
                        onChange={vi.fn()}
                        required={true}
                        validation={{
                            hasError: true,
                            message: 'This field is required',
                        }}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('This field is required')).toBeInTheDocument();
            expect(screen.getByRole('textbox')).toHaveClass('error');
        });

        it('should show validating state', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Validating Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                        isValidating={true}
                    />
                </TestWrapper>
            );

            expect(screen.getByText(/validating/i)).toBeInTheDocument();
        });

        it('should validate required fields', () => {
            const { rerender } = render(
                <TestWrapper>
                    <MediaField
                        label="Required Media"
                        value={null}
                        onChange={vi.fn()}
                        required={true}
                    />
                </TestWrapper>
            );

            // Should show error state for empty required field
            expect(screen.getByRole('button')).toHaveClass('error');

            // Should clear error when value is provided
            rerender(
                <TestWrapper>
                    <MediaField
                        label="Required Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                        required={true}
                    />
                </TestWrapper>
            );

            expect(screen.queryByRole('button')).not.toHaveClass('error');
        });

        it('should validate minimum items for multiple selection', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Multiple Required"
                        value={[mockMultipleMediaValue[0]]}
                        onChange={vi.fn()}
                        multiple={true}
                        minItems={2}
                        validation={{
                            hasError: true,
                            message: 'At least 2 files required',
                        }}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('At least 2 files required')).toBeInTheDocument();
        });

        it('should validate maximum items for multiple selection', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Limited Multiple"
                        value={mockMultipleMediaValue}
                        onChange={vi.fn()}
                        multiple={true}
                        maxItems={1}
                        validation={{
                            hasError: true,
                            message: 'Maximum 1 file allowed',
                        }}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Maximum 1 file allowed')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels and descriptions', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Accessible Media Field"
                        description="Select media files for this content"
                        value={null}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            const button = screen.getByRole('button', { name: /select media/i });
            expect(button).toHaveAttribute('aria-describedby');

            const description = screen.getByText('Select media files for this content');
            expect(description).toHaveAttribute('id');
        });

        it('should support keyboard navigation', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Keyboard Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            const changeButton = screen.getByRole('button', { name: /change/i });
            changeButton.focus();

            await user.keyboard('{Enter}');

            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });

        it('should announce changes to screen readers', async () => {
            const mockOnChange = vi.fn();

            render(
                <TestWrapper>
                    <MediaField
                        label="Announced Media"
                        value={null}
                        onChange={mockOnChange}
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            const selectMediaButton = screen.getByTestId('select-media-btn');
            await user.click(selectMediaButton);

            // Should have aria-live region for announcements
            const statusRegion = screen.getByRole('status');
            expect(statusRegion).toHaveTextContent(/selected/i);
        });

        it('should have accessible error messages', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Error Media"
                        value={null}
                        onChange={vi.fn()}
                        validation={{
                            hasError: true,
                            message: 'This field has an error',
                        }}
                    />
                </TestWrapper>
            );

            const button = screen.getByRole('button');
            const errorMessage = screen.getByText('This field has an error');

            expect(button).toHaveAttribute('aria-describedby');
            expect(errorMessage).toHaveAttribute('role', 'alert');
        });

        it('should provide clear focus indicators', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Focus Media"
                        value={mockMultipleMediaValue}
                        onChange={vi.fn()}
                        multiple={true}
                    />
                </TestWrapper>
            );

            const buttons = screen.getAllByRole('button');

            for (const button of buttons) {
                button.focus();
                expect(button).toHaveClass('focus-visible');
            }
        });
    });

    describe('Integration with Schema-Driven Forms', () => {
        it('should work with form validation context', () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Form Media"
                        value={null}
                        onChange={vi.fn()}
                        required={true}
                        validation={{
                            hasError: false,
                            message: '',
                        }}
                    />
                </TestWrapper>
            );

            // Should integrate properly with form validation
            expect(screen.getByRole('button')).not.toHaveClass('error');
        });

        it('should handle namespace prop correctly', async () => {
            render(
                <TestWrapper>
                    <MediaField
                        label="Namespaced Media"
                        value={null}
                        onChange={vi.fn()}
                        namespace="custom-namespace"
                    />
                </TestWrapper>
            );

            const selectButton = screen.getByRole('button', { name: /select media/i });
            await user.click(selectButton);

            // MediaPicker should receive namespace prop
            expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument();
        });

        it('should preserve field state during form updates', () => {
            const { rerender } = render(
                <TestWrapper>
                    <MediaField
                        label="Persistent Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Existing Image')).toBeInTheDocument();

            // Rerender with same value
            rerender(
                <TestWrapper>
                    <MediaField
                        label="Persistent Media"
                        value={mockSingleMediaValue}
                        onChange={vi.fn()}
                    />
                </TestWrapper>
            );

            // Should maintain display state
            expect(screen.getByText('Existing Image')).toBeInTheDocument();
        });
    });
});
