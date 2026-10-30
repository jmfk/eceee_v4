import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import ExpandableImageField from '../ExpandableImageField'

vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: vi.fn() }),
}))
vi.mock('../ImageDisplaySection', () => ({ default: () => null }))
vi.mock('../../media/MediaSelectModal', () => ({
    default: ({ isOpen, onSelect }) => isOpen && (
        <button onClick={() => onSelect([{ id: 'collection-1', title: 'Summer images', fileCount: 2, sampleImages: [] }])}>
            Choose collection
        </button>
    ),
}))

it('stores a collection list result as a collection reference', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExpandableImageField label="Image" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Select Image/ }))
    await user.click(screen.getByRole('button', { name: 'Choose collection' }))

    expect(onChange).toHaveBeenCalledWith({ id: 'collection-1', type: 'collection' })
})
