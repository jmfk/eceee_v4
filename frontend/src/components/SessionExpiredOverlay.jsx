import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useAuth } from '../contexts/AuthContext'
import AuthenticationForm from './auth/AuthenticationForm'

export default function SessionExpiredOverlay() {
    const { sessionExpired, login } = useAuth()
    if (!sessionExpired) return null
    return <Dialog open onClose={() => {}} className="relative z-[100]">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <DialogTitle className="text-xl font-semibold text-gray-900">Sign in to continue</DialogTitle>
            <p className="mb-6 mt-2 text-sm text-gray-600">Your session expired. Your current work stays open.</p>
            <AuthenticationForm onAuthenticated={login} destination={`${window.location.pathname}${window.location.search}${window.location.hash}`} />
        </DialogPanel>
        </div>
    </Dialog>
}
