import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useAuth } from '../contexts/AuthContext'
import { stopUserPerspective } from '../api/userPerspective'
import AuthenticationForm, { authButtonClass } from './auth/AuthenticationForm'

export default function SessionExpiredOverlay() {
    const { sessionExpired, login, user } = useAuth()
    const [requiresLogin, setRequiresLogin] = useState(false)
    const [returning, setReturning] = useState(false)
    const [error, setError] = useState('')
    if (!sessionExpired) return null
    const canReturn = user?.userPerspective && !requiresLogin
    const restore = async () => {
        setReturning(true)
        setError('')
        try { await stopUserPerspective() }
        catch (error) {
            if ([401, 403].includes(error.response?.status)) setRequiresLogin(true)
            else setError('Could not return to your account. Please try again.')
            setReturning(false)
        }
    }
    return <Dialog open onClose={() => {}} className="relative z-[2000]">
        <div className="fixed inset-0 bg-gray-50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
            <DialogPanel className="w-full max-w-md space-y-6">
                <header>
                    <DialogTitle className="text-3xl font-bold text-gray-900">ECEEE CMS</DialogTitle>
                    <p className="mt-2 text-gray-600">{canReturn
                        ? 'The user view could not continue. Return to your administrator account.'
                        : 'Your session ended. Sign in again to continue your work.'}</p>
                </header>
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    {canReturn ? <>
                        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
                        <button type="button" className={`${authButtonClass} w-full`} disabled={returning} onClick={restore}>{returning ? 'Returning…' : 'Return to my administrator account'}</button>
                    </> : <AuthenticationForm onAuthenticated={login} allowProviderRedirects={false} />}
                </div>
            </DialogPanel>
        </div>
    </Dialog>
}
