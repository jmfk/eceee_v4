import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SchemaFormPreview from '../../components/SchemaFormPreview'

describe('SchemaFormPreview', () => {
    it('renders JSON preview as text without injecting HTML', () => {
        const schema = {
            type: 'object',
            properties: {
                bio: { type: 'string', description: '<img src=x onerror=alert(1)>' }
            },
            required: []
        }
        render(<SchemaFormPreview schema={schema} />)
        // The description should be visible as text, not executed
        expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    })
})


