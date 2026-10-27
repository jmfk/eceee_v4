import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    getCurrentTenantId,
    subscribeToCurrentTenantId,
} from '../../utils/tenant'
import { useAuth } from '../../contexts/AuthContext'
import { supportRequest } from '../../api/support'

export const useSupportTenant = () => {
    const location = useLocation()
    const current = useSyncExternalStore(
        subscribeToCurrentTenantId,
        getCurrentTenantId,
    )
    // Inbox deep links and their help articles retain workspace scope; the server verifies membership.
    return (
        ((location.pathname.startsWith('/inbox') || location.pathname.startsWith('/help/how-to/')) &&
            new URLSearchParams(location.search).get('tenant')) ||
        current
    )
}

export const useSupportIdentity = () => {
    const { user } = useAuth()
    return user?.id || user?.username || 'anonymous'
}

export const useSupportContext = () => {
    const { user } = useAuth()
    const identity = useSupportIdentity()
    const tenant = useSupportTenant()
    return useQuery({
        queryKey: ['support', tenant, identity, 'context'],
        queryFn: () => supportRequest(tenant, 'context/'),
        enabled: !user?.isKanbanBoardGuest,
        refetchInterval: 60000,
        retry: false,
    })
}
