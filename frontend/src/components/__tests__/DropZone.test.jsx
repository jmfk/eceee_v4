import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DropZone from '../DropZone'

describe('DropZone', () => {
    it('renders when visible', () => {
        const { container } = render(
            <DropZone
                position="before"
                isVisible={true}
                isHovered={false}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        const dropzone = container.querySelector('.border-gray-300')
        expect(dropzone).toBeInTheDocument()
    })

    it('does not render when not visible', () => {
        const { container } = render(
            <DropZone
                position="before"
                isVisible={false}
                isHovered={false}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        expect(container.firstChild).toBeNull()
    })

    it('shows correct text for different positions', () => {
        const { rerender } = render(
            <DropZone
                position="before"
                isVisible={true}
                isHovered={false}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        expect(screen.getByText('Drop before Test Page')).toBeInTheDocument()

        rerender(
            <DropZone
                position="inside"
                isVisible={true}
                isHovered={false}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        expect(screen.getByText('Drop inside Test Page')).toBeInTheDocument()

        rerender(
            <DropZone
                position="after"
                isVisible={true}
                isHovered={false}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        expect(screen.getByText('Drop after Test Page')).toBeInTheDocument()
    })

    it('applies correct positioning styles and hover states', () => {
        const { rerender, container } = render(
            <DropZone
                position="before"
                isVisible={true}
                isHovered={false}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        let dropzone = container.querySelector('.border-gray-300')
        expect(dropzone).toHaveClass('border-t-4', 'border-gray-300')

        rerender(
            <DropZone
                position="before"
                isVisible={true}
                isHovered={true}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        dropzone = container.querySelector('.border-blue-500')
        expect(dropzone).toHaveClass('border-t-4', 'border-blue-500')

        rerender(
            <DropZone
                position="inside"
                isVisible={true}
                isHovered={true}
                onDrop={vi.fn()}
                onMouseEnter={vi.fn()}
                onMouseLeave={vi.fn()}
                level={0}
                targetPageTitle="Test Page"
            />
        )

        dropzone = container.querySelector('.border-blue-500')
        expect(dropzone).toHaveClass('border-2', 'border-dashed', 'rounded-md')
    })
}) 