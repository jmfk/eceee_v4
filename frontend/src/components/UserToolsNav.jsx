import { Link, useLocation } from 'react-router-dom'
import { User, Inbox, Columns3, Flag } from 'lucide-react'
import { safeReportLocation } from '../api/support'
import './user-tools.css'

export default function UserToolsNav({ tenant, unreadCount = 0 }) {
    const location = useLocation()
    const reportFrom = safeReportLocation(location.state?.reportFrom || window.location.href)
    const links = [
        { title: 'Profile', href: '/profile', icon: User, active: location.pathname === '/profile' },
        { title: `Inbox${unreadCount ? ` (${unreadCount})` : ''}`, href: tenant ? `/inbox?tenant=${encodeURIComponent(tenant)}` : '/inbox', icon: Inbox, active: location.pathname.startsWith('/inbox') && !location.pathname.startsWith('/inbox/new') },
        { title: 'Kanban', href: '/kanban', icon: Columns3, active: location.pathname.startsWith('/kanban') },
        { title: 'Rapportera fel', href: `/inbox/new?tenant=${encodeURIComponent(tenant || '')}&from=${encodeURIComponent(reportFrom)}`, icon: Flag, active: location.pathname.startsWith('/inbox/new') },
    ]
    return <nav aria-label="Personliga verktyg" className="user-tools-nav">
        {links.map(({ title, href, icon: Icon, active }) => <Link key={title} to={href} state={{ reportFrom }} aria-current={active ? 'page' : undefined}><Icon size={16} aria-hidden="true" />{title}</Link>)}
    </nav>
}
