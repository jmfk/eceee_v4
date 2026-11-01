import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('../../../api', () => ({ mediaApi: { files: { update: mocks.update } } }))
vi.mock('../../../utils/imgproxySecure', () => ({ getImgproxyUrl: vi.fn().mockResolvedValue('/preview.jpg') }))

import ImageFocalPointDialog from '../ImageFocalPointDialog'
import { getFocalCropStyle } from '../focalCrop'

const file = { id: 'image-1', title: 'Annual logo', fileUrl: '/logo.jpg' }

describe('ImageFocalPointDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.update.mockReturnValue(vi.fn().mockResolvedValue({ ...file, focalPoint: { x: 0.25, y: 0.5 } }))
    })

    it('centers the focus where possible and limits shrinking to half size', () => {
        const image = { width: 1200, height: 800 }
        const frame = { width: 192, height: 108 }
        expect(getFocalCropStyle(image, frame, { x: 0.25, y: 0.75 })).toEqual({
            width: '600px', height: '400px', left: '-54px', top: '-246px',
        })
        expect(getFocalCropStyle(image, frame, { x: 0, y: 0 })).toMatchObject({ left: '0px', top: '0px' })
        expect(getFocalCropStyle(image, frame, { x: 1, y: 1 })).toMatchObject({ left: '-408px', top: '-292px' })
    })

    it('centers an off-center point in a small collection tile', () => {
        const tile = { width: 100, height: 100 }
        const image = { width: 1000, height: 500 }
        expect(getFocalCropStyle(image, tile, { x: 0.25, y: 0.5 }, 0)).toEqual({
            width: '200px', height: '100px', left: '0px', top: '0px',
        })
        expect(getFocalCropStyle(image, tile, { x: 0.75, y: 0.5 }, 0)).toMatchObject({ left: '-100px' })
    })

    it('previews three crops live and saves the chosen point', async () => {
        const user = userEvent.setup()
        const onSaved = vi.fn()
        const onClose = vi.fn()
        render(<ImageFocalPointDialog file={file} onClose={onClose} onSaved={onSaved} />)

        for (const shape of ['Landscape', 'Portrait', 'Square']) {
            expect(screen.getByAltText(`${shape} crop preview`)).toHaveStyle({ objectPosition: '50% 50%' })
        }

        fireEvent.change(screen.getByRole('slider', { name: /Horizontal/ }), { target: { value: '25' } })
        for (const shape of ['Landscape', 'Portrait', 'Square']) {
            expect(screen.getByAltText(`${shape} crop preview`)).toHaveStyle({ objectPosition: '25% 50%' })
        }

        await user.click(screen.getByRole('button', { name: 'Save focus' }))
        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('image-1', { focal_point: { x: 0.25, y: 0.5 } }))
        expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ focalPoint: { x: 0.25, y: 0.5 } }))
        expect(onClose).toHaveBeenCalled()
    })

    it('starts from an existing point and can reset to center', async () => {
        const user = userEvent.setup()
        render(<ImageFocalPointDialog file={{ ...file, focalPoint: { x: 0.8, y: 0.2 } }} onClose={vi.fn()} />)
        expect(screen.getByAltText('Square crop preview')).toHaveStyle({ objectPosition: '80% 20%' })
        await user.click(screen.getByRole('button', { name: 'Reset to center' }))
        expect(screen.getByAltText('Square crop preview')).toHaveStyle({ objectPosition: '50% 50%' })
    })
})
