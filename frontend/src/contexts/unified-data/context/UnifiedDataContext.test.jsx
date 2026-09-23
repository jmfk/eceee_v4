import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useUnifiedData } from './UnifiedDataContext'
import { renderWithStateProviders } from '../../../test/testUtils'
import { createAppState } from '../../../test/unifiedDataTestUtils'
import { OperationTypes } from '../types/operations'

const mocks = vi.hoisted(() => ({
    updateCurrentObjectVersion: vi.fn(),
}))

vi.mock('../../../api/objectStorage', async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        objectInstancesApi: {
            ...actual.objectInstancesApi,
            updateCurrentVersion: mocks.updateCurrentObjectVersion,
        },
    }
})

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

const ObjectSaveProbe = () => {
    const { getState, saveCurrentVersion, setIsDirty } = useUnifiedData()
    const [dirty, setDirty] = useState(() => String(getState().metadata.isDirty))

    const markDirty = () => {
        setIsDirty(true)
        setDirty(String(getState().metadata.isDirty))
    }

    const save = async () => {
        try {
            await saveCurrentVersion()
        } catch {
            // The assertion below verifies that a failed request remains dirty.
        }
        setDirty(String(getState().metadata.isDirty))
    }

    return (
        <div>
            <div data-testid="object-dirty-state">{dirty}</div>
            <button type="button" onClick={markDirty}>Edit object</button>
            <button type="button" onClick={save}>Save object</button>
        </div>
    )
}

const objectEditorState = () => createAppState({
    pages: {},
    versions: {},
    objects: {
        'object-1': {
            id: 'object-1',
            title: 'Object title',
            data: {},
            widgets: {},
            metadata: {},
        },
    },
    metadata: {
        currentPageId: undefined,
        currentVersionId: undefined,
        currentObjectId: 'object-1',
    },
})

describe('UnifiedDataContext test provider', () => {
    beforeEach(() => {
        mocks.updateCurrentObjectVersion.mockReset()
    })

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

    it('clears object dirty state only after a successful save', async () => {
        mocks.updateCurrentObjectVersion.mockResolvedValue({ id: 'object-version-1' })
        renderWithStateProviders(<ObjectSaveProbe />, { initialState: objectEditorState() })

        fireEvent.click(screen.getByRole('button', { name: /edit object/i }))
        expect(screen.getByTestId('object-dirty-state')).toHaveTextContent('true')
        fireEvent.click(screen.getByRole('button', { name: /save object/i }))

        await waitFor(() => {
            expect(screen.getByTestId('object-dirty-state')).toHaveTextContent('false')
        })
    })

    it('keeps object dirty state after a failed save', async () => {
        mocks.updateCurrentObjectVersion.mockRejectedValue(new Error('Save failed'))
        renderWithStateProviders(<ObjectSaveProbe />, { initialState: objectEditorState() })

        fireEvent.click(screen.getByRole('button', { name: /edit object/i }))
        fireEvent.click(screen.getByRole('button', { name: /save object/i }))

        await waitFor(() => {
            expect(mocks.updateCurrentObjectVersion).toHaveBeenCalledOnce()
            expect(screen.getByTestId('object-dirty-state')).toHaveTextContent('true')
        })
    })
})
