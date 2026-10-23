import { useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import AuthenticationForm from '../components/auth/AuthenticationForm'
import PasswordRecoveryForm from '../components/auth/PasswordRecoveryForm'
import { safeDestination } from '../api/auth'

export default function LoginPage() {
    useDocumentTitle('Login')
    const navigate = useNavigate()
    const location = useLocation()
    const { login, isAuthenticated, isLoading } = useAuth()
    const target = location.state?.from
    const destination = safeDestination(target ? `${target.pathname}${target.search || ''}${target.hash || ''}` : sessionStorage.getItem('cms_auth_destination'))
    const query = new URLSearchParams(location.search)
    const recovery = query.has('resetPassword') || query.has('resetKey') || query.has('emailKey')
    useEffect(() => {
        if (!isLoading && isAuthenticated && !recovery) {
            sessionStorage.removeItem('cms_auth_destination')
            navigate(destination, { replace: true })
        }
    }, [isAuthenticated, isLoading, navigate, destination, recovery])
    return <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
            <header><h1 className="text-3xl font-bold text-gray-900">ECEEE CMS</h1><p className="mt-2 text-gray-600">Sign in to your existing account</p></header>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                {recovery ? <PasswordRecoveryForm query={query} /> : <AuthenticationForm destination={destination} onAuthenticated={login} />}
            </div>
            {!recovery && <Link className="text-sm text-blue-700 underline" to="/login?resetPassword=1">Forgot password?</Link>}
        </div>
    </main>
}
