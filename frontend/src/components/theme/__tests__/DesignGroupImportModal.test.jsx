import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DesignGroupImportModal from '../DesignGroupImportModal'

const mocks = vi.hoisted(() => ({
    listImportableDesignGroups: vi.fn(),
    previewDesignGroupImport: vi.fn(),
    importDesignGroups: vi.fn(),
    addNotification: vi.fn(),
}))

vi.mock('../../../api/themes', () => ({
    themesApi: {
        listImportableDesignGroups: mocks.listImportableDesignGroups,
        previewDesignGroupImport: mocks.previewDesignGroupImport,
        importDesignGroups: mocks.importDesignGroups,
    },
}))

vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))

describe('DesignGroupImportModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listImportableDesignGroups.mockResolvedValue({
            themes: [{
                id: 8,
                name: 'Source Theme',
                groups: [{ index: 0, name: 'Header', widgetTypes: ['easy_widgets.HeaderWidget'], slots: [], imageCount: 4 }],
            }],
        })
        mocks.previewDesignGroupImport.mockResolvedValue({
            groups: [{ name: 'Header', conflict: true, imageCount: 4 }],
            conflictCount: 1,
            imageCount: 4,
        })
        mocks.importDesignGroups.mockResolvedValue({
            message: "Imported 1 design group(s) from 'Source Theme'",
            designGroups: { groups: [{ name: 'Header' }] },
        })
    })

    it('reviews conflicts before offering skip or overwrite', async () => {
        const user = userEvent.setup()
        render(<DesignGroupImportModal themeId={10} onClose={vi.fn()} onImported={vi.fn()} />)

        await user.selectOptions(await screen.findByLabelText('Source theme'), '8')
        await user.click(screen.getByRole('checkbox', { name: /Header/ }))
        await user.click(screen.getByRole('button', { name: 'Review import' }))

        expect(await screen.findByText('1 name conflict found')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Skip conflicts' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Overwrite conflicts' })).toBeInTheDocument()
        expect(mocks.importDesignGroups).not.toHaveBeenCalled()
    })

    it('imports with the chosen overwrite resolution', async () => {
        const user = userEvent.setup()
        const onImported = vi.fn()
        const onClose = vi.fn()
        render(<DesignGroupImportModal themeId={10} onClose={onClose} onImported={onImported} />)

        await user.selectOptions(await screen.findByLabelText('Source theme'), '8')
        await user.click(screen.getByRole('checkbox', { name: /Header/ }))
        await user.click(screen.getByRole('button', { name: 'Review import' }))
        await user.click(await screen.findByRole('button', { name: 'Overwrite conflicts' }))

        await waitFor(() => expect(mocks.importDesignGroups).toHaveBeenCalledWith(10, {
            sourceThemeId: 8,
            groupIndices: [0],
            conflictResolution: 'overwrite',
        }))
        expect(onImported).toHaveBeenCalledWith({ groups: [{ name: 'Header' }] })
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('blocks importing while the destination has unsaved changes', async () => {
        render(
            <DesignGroupImportModal
                themeId={10}
                onClose={vi.fn()}
                onImported={vi.fn()}
                hasUnsavedChanges
            />
        )

        expect(await screen.findByText('Save your current theme changes first')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Review import' })).not.toBeInTheDocument()
    })
})
