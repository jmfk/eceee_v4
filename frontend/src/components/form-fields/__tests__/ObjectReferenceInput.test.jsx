import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ObjectReferenceInput from '../ObjectReferenceInput'
import { objectRelationshipsApi } from '../../../api/objectStorage'

// Mock the API
jest.mock('../../../api/objectStorage', () => ({
    objectRelationshipsApi: {
        searchForReferences: jest.fn(),
        getObjectDetails: jest.fn()
    }
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                cacheTime: 0
            }
        }
    })

    return ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('ObjectReferenceInput', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders with label', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                label="Authors"
                multiple={true}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByText('Authors')).toBeInTheDocument()
    })

    it('shows required indicator when required', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                label="Authors"
                required={true}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('renders search input', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                placeholder="Search for authors..."
                multiple={true}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByPlaceholderText('Search for authors...')).toBeInTheDocument()
    })

    it('displays selected items as chips (multiple mode)', async () => {
        // Mock getObjectDetails
        objectRelationshipsApi.getObjectDetails.mockResolvedValue({
            data: {
                results: [
                    { id: 123, title: 'John Doe', objectType: { label: 'Columnist' } }
                ]
            }
        })

        render(
            <ObjectReferenceInput
                value={[123]}
                onChange={jest.fn()}
                label="Authors"
                multiple={true}
            />,
            { wrapper: createWrapper() }
        )

        // Wait for the object details to load
        await waitFor(() => {
            expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
        })
    })

    it('calls onChange when removing a chip', async () => {
        const handleChange = jest.fn()

        objectRelationshipsApi.getObjectDetails.mockResolvedValue({
            data: {
                results: [
                    { id: 123, title: 'John Doe', objectType: { label: 'Columnist' } }
                ]
            }
        })

        render(
            <ObjectReferenceInput
                value={[123]}
                onChange={handleChange}
                multiple={true}
            />,
            { wrapper: createWrapper() }
        )

        // Wait for chip to render
        await waitFor(() => {
            expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
        })

        // Find and click the remove button
        const removeButtons = screen.getAllByRole('button')
        const removeButton = removeButtons.find(btn => btn.querySelector('svg'))

        if (removeButton) {
            fireEvent.click(removeButton)
            expect(handleChange).toHaveBeenCalledWith([])
        }
    })

    it('shows max items warning when full', () => {
        objectRelationshipsApi.getObjectDetails.mockResolvedValue({
            data: {
                results: [
                    { id: 123, title: 'John Doe' },
                    { id: 456, title: 'Jane Smith' }
                ]
            }
        })

        render(
            <ObjectReferenceInput
                value={[123, 456]}
                onChange={jest.fn()}
                multiple={true}
                max_items={2}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByText(/Maximum of 2 items reached/i)).toBeInTheDocument()
    })

    it('shows allowed types hint', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                allowed_object_types={['columnist', 'contributor']}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByText(/Allowed types: columnist, contributor/i)).toBeInTheDocument()
    })

    it('shows direct PK entry option', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                multiple={true}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByText(/Add by ID/i)).toBeInTheDocument()
    })

    it('disables input when disabled prop is true', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                disabled={true}
                placeholder="Search..."
            />,
            { wrapper: createWrapper() }
        )

        const searchInput = screen.getByPlaceholderText('Search...')
        expect(searchInput).toBeDisabled()
    })

    it('renders validation error message', () => {
        render(
            <ObjectReferenceInput
                value={[]}
                onChange={jest.fn()}
                validation={{ isValid: false, message: 'This field is required' }}
            />,
            { wrapper: createWrapper() }
        )

        expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('displays single selection correctly', async () => {
        objectRelationshipsApi.getObjectDetails.mockResolvedValue({
            data: {
                results: [
                    { id: 123, title: 'John Doe', objectType: { label: 'Columnist' } }
                ]
            }
        })

        render(
            <ObjectReferenceInput
                value={123}
                onChange={jest.fn()}
                multiple={false}
            />,
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
        })
    })
})

