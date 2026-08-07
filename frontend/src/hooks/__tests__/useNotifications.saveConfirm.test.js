import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useNotifications from '../useNotifications'

describe('useNotifications — showSaveConfirm', () => {
    it('resolves with "save" when onSave is called', async () => {
        const { result } = renderHook(() => useNotifications())

        let decision
        act(() => {
            result.current
                .showSaveConfirm({ title: 'Unsaved', message: 'Save?' })
                .then((d) => { decision = d })
        })

        expect(result.current.saveConfirmDialog).not.toBeNull()

        await act(async () => {
            result.current.saveConfirmDialog.onSave()
        })

        expect(decision).toBe('save')
        expect(result.current.saveConfirmDialog).toBeNull()
    })

    it('resolves with "discard" when onDiscard is called', async () => {
        const { result } = renderHook(() => useNotifications())

        let decision
        act(() => {
            result.current
                .showSaveConfirm({ title: 'Unsaved', message: 'Save?' })
                .then((d) => { decision = d })
        })

        await act(async () => {
            result.current.saveConfirmDialog.onDiscard()
        })

        expect(decision).toBe('discard')
        expect(result.current.saveConfirmDialog).toBeNull()
    })

    it('resolves with "cancel" when onCancel is called', async () => {
        const { result } = renderHook(() => useNotifications())

        let decision
        act(() => {
            result.current
                .showSaveConfirm({ title: 'Unsaved', message: 'Save?' })
                .then((d) => { decision = d })
        })

        await act(async () => {
            result.current.saveConfirmDialog.onCancel()
        })

        expect(decision).toBe('cancel')
        expect(result.current.saveConfirmDialog).toBeNull()
    })

    it('spreads extra options into saveConfirmDialog', () => {
        const { result } = renderHook(() => useNotifications())

        act(() => {
            result.current.showSaveConfirm({ title: 'My Title', message: 'My message', saveText: 'Keep' })
        })

        expect(result.current.saveConfirmDialog).toMatchObject({
            title: 'My Title',
            message: 'My message',
            saveText: 'Keep'
        })
    })

    it('hideSaveConfirm clears the dialog without resolving', () => {
        const { result } = renderHook(() => useNotifications())

        act(() => {
            result.current.showSaveConfirm({ title: 'Test' })
        })

        expect(result.current.saveConfirmDialog).not.toBeNull()

        act(() => {
            result.current.hideSaveConfirm()
        })

        expect(result.current.saveConfirmDialog).toBeNull()
    })
})
