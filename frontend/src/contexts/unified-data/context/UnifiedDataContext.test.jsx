import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useUnifiedData } from './UnifiedDataContext'
import { renderWithStateProviders } from '../../../test/testUtils'
import { createAppState } from '../../../test/unifiedDataTestUtils'
import { OperationTypes } from '../types/operations'

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

const ExternalSnapshotProbe = ({ onSnapshot }) => {
    const { dispatch, useExternalChanges } = useUnifiedData()

    useExternalChanges('snapshot-probe', (state, metadata) => {
        onSnapshot({
            isDirty: state.metadata.isDirty,
            sourceId: metadata?.sourceId
        })
    })

    const dispatchTwoUpdates = () => {
        dispatch({
            type: OperationTypes.SET_DIRTY,
            sourceId: 'first-update',
            payload: { isDirty: true }
        })
        dispatch({
            type: OperationTypes.SET_DIRTY,
            sourceId: 'second-update',
            payload: { isDirty: false }
        })
    }

    return <button type="button" onClick={dispatchTwoUpdates}>Dispatch two updates</button>
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

    it('passes each queued state snapshot to useExternalChanges callbacks', async () => {
        const onSnapshot = vi.fn()

        renderWithStateProviders(<ExternalSnapshotProbe onSnapshot={onSnapshot} />, {
            initialState: createAppState()
        })

        fireEvent.click(screen.getByRole('button', { name: /dispatch two updates/i }))

        await waitFor(() => {
            expect(onSnapshot).toHaveBeenCalledTimes(2)
        })
        expect(onSnapshot.mock.calls.map(([snapshot]) => snapshot)).toEqual([
            { isDirty: true, sourceId: 'first-update' },
            { isDirty: false, sourceId: 'second-update' }
        ])
    })
})
