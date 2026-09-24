import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DesignGroupsPreview from '../DesignGroupsPreview'

describe('DesignGroupsPreview', () => {
    it('scopes theme element styles and color variables to the preview', () => {
        const { container } = render(
            <div>
                <h2>Settings shell heading</h2>
                <DesignGroupsPreview
                    colors={{ ink: '#111827' }}
                    designGroups={{
                        groups: [{
                            name: 'Default',
                            className: 'default',
                            isDefault: true,
                            elements: {
                                h2: { fontSize: '36px', color: 'ink' },
                            },
                        }],
                    }}
                />
            </div>
        )

        const previewStyles = container.querySelector('style').textContent

        expect(previewStyles).toContain('.design-groups-preview {')
        expect(previewStyles).toContain('.design-groups-preview h2 {')
        expect(previewStyles).not.toMatch(/(^|\n)h2\s*\{/)
        expect(screen.getByRole('heading', { name: 'Settings shell heading' })).not.toHaveClass('text-3xl')
        expect(screen.getByRole('heading', { name: /Heading 2 - Jumps/ })).toBeInstanceOf(HTMLHeadingElement)
    })
})
