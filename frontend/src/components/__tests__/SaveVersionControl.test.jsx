import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SaveVersionControl from '../SaveVersionControl'

describe('SaveVersionControl', () => {
    it('keeps the primary save action enabled when there are no unsaved changes', async () => {
        const user = userEvent.setup()
        const onSaveClick = vi.fn()

        render(
            <SaveVersionControl
                currentVersion={{ id: 1, versionNumber: 3 }}
                isDirty={false}
                onSaveClick={onSaveClick}
            />
        )

        const saveButton = screen.getByRole('button', { name: /save v3/i })

        expect(saveButton).toBeEnabled()

        await user.click(saveButton)

        expect(onSaveClick).toHaveBeenCalledTimes(1)
    })
})
