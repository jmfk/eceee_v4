import { Navigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

const DesignerRoute = ({ children }) => {
    const { isAuthenticated, isLoading, user } = useAuth()

    if (isLoading) {
        return <div className="flex min-h-screen items-center justify-center text-gray-600">Checking Designer access…</div>
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }
    if (!user?.isDesignerOnly && !user?.hasTenantAdminAccess && !user?.isStaff && !user?.isSuperuser) {
        return <Navigate to="/pages" replace />
    }
    return children
}

export default DesignerRoute
