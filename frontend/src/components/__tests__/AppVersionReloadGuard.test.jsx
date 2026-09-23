import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UnifiedDataProvider, useUnifiedData } from '../../contexts/unified-data'
import { hasUnsavedEditorChanges } from '../../utils/editorDirtyState'
import AppVersionReloadGuard from '../AppVersionReloadGuard'

const mocks = vi.hoisted(() => ({
    addNotification: vi.fn(),
    resumePendingAppVersionReload: vi.fn(),
}))

vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))

vi.mock('../../api/appVersion', async (importOriginal) => ({
    ...await importOriginal(),
    resumePendingAppVersionReload: mocks.resumePendingAppVersionReload,
}))

const DirtyControls = () => {
    const { setIsDirty, setThemeDirty } = useUnifiedData()

    return (
        <>
            <button type="button" onClick={() => setIsDirty(true)}>Dirty object</button>
            <button type="button" onClick={() => setIsDirty(false)}>Clean object</button>
            <button type="button" onClick={() => setThemeDirty(true)}>Dirty theme</button>
            <button type="button" onClick={() => setThemeDirty(false)}>Clean theme</button>
        </>
    )
}

const renderGuard = (metadata = {}) => render(
    <UnifiedDataProvider initialState={{ metadata }}>
        <AppVersionReloadGuard />
        <DirtyControls />
    </UnifiedDataProvider>
)

const dispatchMismatch = () => {
    let allowed
    act(() => {
        allowed = window.dispatchEvent(new CustomEvent(
            'eceee:app-version-mismatch',
            { cancelable: true, detail: { serverVersion: 'new-build' } },
        ))
    })
    return allowed
}

describe('AppVersionReloadGuard', () => {
    beforeEach(() => {
        mocks.addNotification.mockReset()
        mocks.resumePendingAppVersionReload.mockReset()
    })

    it('recognizes every shared editor dirty signal', () => {
        expect(hasUnsavedEditorChanges({ metadata: { isDirty: true } })).toBe(true)
        expect(hasUnsavedEditorChanges({ metadata: { isThemeDirty: true } })).toBe(true)
        expect(hasUnsavedEditorChanges({ metadata: { isObjectDirty: true } })).toBe(true)
        expect(hasUnsavedEditorChanges({ metadata: {} })).toBe(false)
    })

    it('allows a version mismatch when the shared editor state is clean', () => {
        renderGuard()

        expect(dispatchMismatch()).toBe(true)
        expect(mocks.addNotification).not.toHaveBeenCalled()
        expect(mocks.resumePendingAppVersionReload).not.toHaveBeenCalled()
    })

    it('reads fresh manager state synchronously and suppresses duplicate notices', () => {
        const { getByRole } = renderGuard()
        fireEvent.click(getByRole('button', { name: 'Dirty object' }))

        expect(dispatchMismatch()).toBe(false)
        expect(dispatchMismatch()).toBe(false)
        expect(mocks.addNotification).toHaveBeenCalledOnce()
        expect(mocks.addNotification).toHaveBeenCalledWith(
            'En ny version finns. Spara eller ångra ändringarna; appen laddas sedan om automatiskt.',
            'warning',
            'app-version-reload',
        )
    })

    it('resumes exactly once after every dirty signal becomes clean', async () => {
        const { getByRole } = renderGuard()
        fireEvent.click(getByRole('button', { name: 'Dirty object' }))
        fireEvent.click(getByRole('button', { name: 'Dirty theme' }))
        expect(dispatchMismatch()).toBe(false)

        fireEvent.click(getByRole('button', { name: 'Clean object' }))
        await act(async () => {})
        expect(mocks.resumePendingAppVersionReload).not.toHaveBeenCalled()

        fireEvent.click(getByRole('button', { name: 'Clean theme' }))
        await waitFor(() => {
            expect(mocks.resumePendingAppVersionReload).toHaveBeenCalledOnce()
        })

        fireEvent.click(getByRole('button', { name: 'Clean theme' }))
        await act(async () => {})
        expect(mocks.resumePendingAppVersionReload).toHaveBeenCalledOnce()
    })

    it('guards an object-specific dirty state', () => {
        renderGuard({ isObjectDirty: true })

        expect(dispatchMismatch()).toBe(false)
    })

    it('removes its mismatch listener when unmounted', () => {
        const { getByRole, unmount } = renderGuard()
        fireEvent.click(getByRole('button', { name: 'Dirty object' }))
        unmount()

        expect(dispatchMismatch()).toBe(true)
        expect(mocks.addNotification).not.toHaveBeenCalled()
    })
})
