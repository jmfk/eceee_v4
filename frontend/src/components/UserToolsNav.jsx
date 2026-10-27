import { useAuth } from '../contexts/AuthContext'
import { canAccessCmsPath } from '../utils/cmsNavigation'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, User, Inbox, Columns3, Flag, LogOut } from 'lucide-react'
import { safeReportLocation } from '../api/support'
import { useSupportContext } from './support/useSupportContext'
import './user-tools.css'

export default function UserToolsNav({ tenant, unreadCount = 0 }) {
    const { user, logout } = useAuth()
    const support = useSupportContext()
    const location = useLocation()
    const reportFrom = safeReportLocation(location.state?.reportFrom || window.location.href)
    const cmsPath = user?.isKanbanBoardGuest ? undefined :
        ['/pages', '/objects', '/media', '/statistics', '/tags', '/designer/themes', '/settings']
            .find((path) => canAccessCmsPath(user, path)) || (support.data?.canSupport ? `/settings/support${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''}` : undefined)
    const links = [
        { title: `Inbox${unreadCount ? ` (${unreadCount})` : ''}`, href: tenant ? `/inbox?tenant=${encodeURIComponent(tenant)}` : '/inbox', icon: Inbox, active: location.pathname.startsWith('/inbox') && !location.pathname.startsWith('/inbox/new'), requiresWorkspaceAccess: true },
        { title: 'Kanban', href: '/kanban', icon: Columns3, active: location.pathname.startsWith('/kanban') },
        { title: 'Profile', href: '/profile', icon: User, active: location.pathname === '/profile' },
        { title: 'Rapportera fel', href: `/inbox/new?tenant=${encodeURIComponent(tenant || '')}&from=${encodeURIComponent(reportFrom)}`, icon: Flag, active: location.pathname.startsWith('/inbox/new'), requiresWorkspaceAccess: true },
    ]
    return <nav aria-label="Personliga verktyg" className="user-tools-nav">
        {cmsPath && <Link to={cmsPath} className="user-tools-cms-link"><ArrowLeft size={16} aria-hidden="true" />Till CMS</Link>}
        {links.filter((item) => (!item.requiresWorkspaceAccess || !user?.isKanbanBoardGuest) && canAccessCmsPath(user, item.href)).map((item) => <Link key={item.title} to={item.href} state={{ reportFrom }} aria-current={item.active ? 'page' : undefined}><item.icon size={16} aria-hidden="true" />{item.title}</Link>)}
        <button type="button" className="user-tools-logout" onClick={logout}><LogOut size={16} aria-hidden="true" />Logout</button>
    </nav>
}
