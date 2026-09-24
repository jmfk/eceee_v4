import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import StatusBar from '../StatusBar'

vi.mock('../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({
        clipboardData: null,
        pasteModePaused: false,
        togglePasteMode: vi.fn(),
        clearClipboardState: vi.fn(),
    }),
}))

vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({
        notifications: [],
        currentNotificationIndex: 0,
        clearNotifications: vi.fn(),
        navigateNotifications: vi.fn(),
        goToNotification: vi.fn(),
    }),
}))

vi.mock('../../contexts/unified-data', () => ({
    useUnifiedData: () => ({ useExternalChanges: vi.fn() }),
}))

describe('StatusBar', () => {
    it('does not show editor controls or an empty clipboard on read-only views', () => {
        render(<StatusBar customStatusContent={<span>Pages Management - Ready</span>} />)

        expect(screen.getByText('Pages Management - Ready')).toBeInTheDocument()
        expect(screen.queryByText('Empty')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /publish changes/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /schedule/i })).not.toBeInTheDocument()
    })
})
