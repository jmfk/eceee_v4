import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReleaseBadge from '../ReleaseBadge'

const fullHash = '1234567890abcdef1234567890abcdef12345678'
const configureBuild = (tag = 'v1.2.3', full = fullHash, short = '12345678') => {
    vi.stubEnv('VITE_RELEASE_TAG', tag)
    vi.stubEnv('VITE_GIT_COMMIT_FULL_HASH', full)
    vi.stubEnv('VITE_GIT_COMMIT_HASH', short)
}

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('ReleaseBadge', () => {
    it('shows the release tag, reveals the full hash on focus, and copies the hash rather than the tag', async () => {
        configureBuild()
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { clipboard: { writeText } })
        render(<ReleaseBadge />)
        const badge = screen.getByRole('button', { name: 'v1.2.3 — copy commit hash' })
        expect(badge).toHaveTextContent(/^v1.2.3$/)
        expect(badge).toHaveAccessibleDescription(`Commit hash: ${fullHash}`)
        fireEvent.focus(badge)
        expect(await screen.findByText(`Git commit ${fullHash}`)).toBeVisible()
        fireEvent.click(badge)
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(fullHash))
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Commit hash copied'))
    })

    it('exposes the full hash on mouse hover', async () => {
        configureBuild()
        render(<ReleaseBadge />)
        fireEvent.mouseEnter(screen.getByRole('button').parentElement)
        expect(await screen.findByText(`Git commit ${fullHash}`)).toBeVisible()
    })

    it('keeps an untagged development build identifiable and copies its available hash', async () => {
        configureBuild('', '', '12345678')
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { clipboard: { writeText } })
        render(<ReleaseBadge />)
        fireEvent.click(screen.getByRole('button', { name: 'Git 12345678 — copy commit hash' }))
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('12345678'))
    })

    it('reports a rejected clipboard operation without claiming success', async () => {
        configureBuild()
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
        render(<ReleaseBadge />)
        fireEvent.click(screen.getByRole('button'))
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not copy commit hash. Try again.'))
    })

    it('disables copying when commit metadata is missing', () => {
        configureBuild('', '', '')
        render(<ReleaseBadge />)
        expect(screen.getByRole('button', { name: 'Git unknown' })).toBeDisabled()
    })
})
