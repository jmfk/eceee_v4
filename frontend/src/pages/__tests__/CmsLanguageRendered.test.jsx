import { afterEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TagsPage from '../TagsPage'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

vi.mock('../../components/classification/ClassificationManager', () => ({ default: () => null }))
vi.mock('../../components/help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }))

afterEach(() => setCmsCopyLanguage('en-us'))

it('renders static CMS copy in Swedish when selected', () => {
    setCmsCopyLanguage('sv-se')
    render(<TagsPage />)
    expect(screen.getByRole('heading', { name: 'Taggar' })).toBeInTheDocument()
})
