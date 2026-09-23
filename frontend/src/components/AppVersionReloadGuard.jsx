import { useEffect, useRef } from 'react'

import {
    APP_VERSION_MISMATCH_EVENT,
    resumePendingAppVersionReload,
} from '../api/appVersion'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useUnifiedData } from '../contexts/unified-data'
import { hasUnsavedEditorChanges } from '../utils/editorDirtyState'

const RELOAD_NOTIFICATION_CATEGORY = 'app-version-reload'

const AppVersionReloadGuard = () => {
    const { getState, subscribe } = useUnifiedData()
    const { addNotification } = useGlobalNotifications()
    const reloadPendingRef = useRef(false)

    useEffect(() => {
        const handleVersionMismatch = (event) => {
            // This event is followed immediately by a reload, so read the manager
            // synchronously instead of relying on a potentially stale React snapshot.
            if (!hasUnsavedEditorChanges(getState())) return

            event.preventDefault()
            if (!reloadPendingRef.current) {
                addNotification(
                    'En ny version finns. Spara eller ångra ändringarna; appen laddas sedan om automatiskt.',
                    'warning',
                    RELOAD_NOTIFICATION_CATEGORY,
                )
            }
            reloadPendingRef.current = true
        }

        window.addEventListener(APP_VERSION_MISMATCH_EVENT, handleVersionMismatch)
        const unsubscribe = subscribe(
            hasUnsavedEditorChanges,
            (hasUnsavedChanges) => {
                if (!reloadPendingRef.current || hasUnsavedChanges) return

                reloadPendingRef.current = false
                resumePendingAppVersionReload()
            },
        )

        return () => {
            window.removeEventListener(APP_VERSION_MISMATCH_EVENT, handleVersionMismatch)
            unsubscribe()
        }
    }, [addNotification, getState, subscribe])

    return null
}

export default AppVersionReloadGuard
