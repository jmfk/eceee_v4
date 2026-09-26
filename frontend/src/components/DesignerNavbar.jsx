import { Link } from 'react-router-dom'
import { LogOut, Palette } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

const DesignerNavbar = () => {
    const { logout, user } = useAuth()
    return (
        <nav className="border-b border-gray-200 bg-white" aria-label="Designer navigation">
            <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
                <Link to="/designer/themes" className="inline-flex items-center gap-2 font-semibold text-gray-900">
                    <Palette className="h-5 w-5 text-blue-600" />
                    Designer themes
                </Link>
                <div className="flex items-center gap-3">
                    {user?.username && <span className="hidden text-sm text-gray-500 sm:inline">{user.username}</span>}
                    <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600">
                        <LogOut className="h-4 w-4" />Logout
                    </button>
                </div>
            </div>
        </nav>
    )
}

export default DesignerNavbar
