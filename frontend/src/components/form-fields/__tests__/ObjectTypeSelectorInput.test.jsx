import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ObjectTypeSelectorInput from '../ObjectTypeSelectorInput'
const list = vi.hoisted(() => vi.fn())
vi.mock('../../../api/objectStorage', () => ({ objectTypesApi: { list } }))
vi.mock('../../media/OptimizedImage', () => ({ default: () => null }))

describe('Object type selector', () => {
    it('uses the authenticated API client and resolves saved type names without changing the stored value', async () => {
        list.mockResolvedValue({ data: { results: [{ id: 8, name: 'article', label: 'Article' }] } })
        const onChange = vi.fn()
        render(<ObjectTypeSelectorInput value={['article']} onChange={onChange} />)
        await screen.findByText('Article')
        expect(list).toHaveBeenCalledWith({ is_active: true })
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByText('Article').closest('button'))
        fireEvent.click(screen.getAllByText('Article')[1])
        expect(onChange).toHaveBeenCalledWith([])
    })
})
