import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, LogOut, Palette, FolderOpen } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { canAccessCmsPath } from '../utils/cmsNavigation'

const DesignerNavbar = ({
    cmsNavigationDisabled = false,
    cmsNavigationDisabledReason = 'Save or discard local changes before returning to CMS',
}) => {
    const { logout, user } = useAuth()
    const { pathname } = useLocation()
    const mediaHref = user?.isDesignerOnly ? '/designer/media' : '/media'
    const canBrowseMedia = user?.isDesignerOnly || canAccessCmsPath(user, '/media')
    const cmsLinkContent = <>
        <ArrowLeft className="h-4 w-4" />
        <span aria-hidden="true"><span className="hidden sm:inline">Back to </span>CMS</span>
    </>

    return (
        <nav className="border-b border-gray-200 bg-white" aria-label="Designer navigation">
            <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
                <div className="flex h-full min-w-0 items-stretch gap-4 overflow-x-auto">
                    {[...(canBrowseMedia ? [{ name: 'Media', href: mediaHref, icon: FolderOpen }] : []), { name: 'Designer', href: '/designer/themes', icon: Palette }].map((item) => {
                        const mediaActive = pathname === mediaHref || pathname.startsWith(mediaHref + '/')
                        const active = item.name === 'Media' ? mediaActive : pathname.startsWith('/designer') && !mediaActive
                        const classes = `inline-flex shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`
                        const content = <><item.icon className="h-4 w-4" aria-hidden="true" />{item.name}</>
                        return cmsNavigationDisabled && item.name === 'Media'
                            ? <button key={item.name} type="button" disabled title={cmsNavigationDisabledReason} className={`${classes} opacity-50`}>{content}</button>
                            : <Link key={item.name} to={item.href} aria-current={active ? 'page' : undefined} className={classes}>{content}</Link>
                    })}
                </div>
                <div className="flex items-center gap-3">
                    {!user?.isDesignerOnly && (cmsNavigationDisabled
                        ? <button type="button" disabled aria-label="Back to CMS" title={cmsNavigationDisabledReason} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-400">{cmsLinkContent}</button>
                        : <Link to="/pages" aria-label="Back to CMS" className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">{cmsLinkContent}</Link>
                    )}
                    {user?.username && <span className="hidden text-sm text-gray-500 sm:inline">{user.username}</span>}
                    <button type="button" onClick={logout} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600">
                        <LogOut className="h-4 w-4" />Logout
                    </button>
                </div>
            </div>
        </nav>
    )
}

export default DesignerNavbar
