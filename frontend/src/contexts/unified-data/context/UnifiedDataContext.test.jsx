import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useUnifiedData } from './UnifiedDataContext'
import { renderWithStateProviders } from '../../../test/testUtils'
import { createAppState } from '../../../test/unifiedDataTestUtils'

const StateProbe = () => {
    const { getState, setIsDirty } = useUnifiedData()
    const [dirty, setDirty] = useState(() => String(getState().metadata.isDirty))

    const markDirty = () => {
        setIsDirty(true)
        setDirty(String(getState().metadata.isDirty))
    }

    return (
        <div>
            <div data-testid="dirty-state">{dirty}</div>
            <button type="button" onClick={markDirty}>Mark dirty</button>
        </div>
    )
}

describe('UnifiedDataContext test provider', () => {
    it('renders state-aware components with the shared provider harness', async () => {
        renderWithStateProviders(<StateProbe />, {
            initialState: createAppState()
        })

        expect(screen.getByTestId('dirty-state')).toHaveTextContent('false')
        fireEvent.click(screen.getByRole('button', { name: /mark dirty/i }))
        await waitFor(() => {
            expect(screen.getByTestId('dirty-state')).toHaveTextContent('true')
        })
    })
})
