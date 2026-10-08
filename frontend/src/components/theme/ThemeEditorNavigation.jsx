import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'

const ThemeEditorNavigation = ({ groups, activeTab, onSelect }) => {
    const [openGroup, setOpenGroup] = useState(null)
    const [mobileOpen, setMobileOpen] = useState(false)
    const navigationRef = useRef(null)
    const activeItem = useMemo(
        () => groups.flatMap((group) => group.items).find((item) => item.id === activeTab),
        [activeTab, groups],
    )

    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape') return
            setOpenGroup(null)
            setMobileOpen(false)
        }
        const closeOutside = (event) => {
            if (navigationRef.current?.contains(event.target)) return
            setOpenGroup(null)
            setMobileOpen(false)
        }
        document.addEventListener('keydown', closeOnEscape)
        document.addEventListener('pointerdown', closeOutside)
        return () => {
            document.removeEventListener('keydown', closeOnEscape)
            document.removeEventListener('pointerdown', closeOutside)
        }
    }, [])

    useEffect(() => {
        setOpenGroup(null)
        setMobileOpen(false)
    }, [activeTab])

    const selectTab = (tabId) => {
        setOpenGroup(null)
        setMobileOpen(false)
        onSelect(tabId)
    }

    return <nav ref={navigationRef} aria-label="Theme editor sections" className="border-t border-gray-100 bg-white">
        <div className="hidden items-center gap-2 px-6 py-2 md:flex">
            {groups.map((group) => {
                const isActiveGroup = group.items.some((item) => item.id === activeTab)
                const expanded = openGroup === group.id
                return <div key={group.id} className="relative">
                    <button
                        type="button"
                        onClick={() => setOpenGroup(expanded ? null : group.id)}
                        aria-expanded={expanded}
                        aria-haspopup="menu"
                        className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActiveGroup ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <span>{group.label}</span>
                        {isActiveGroup && activeItem && <span className="max-w-32 truncate text-xs font-normal text-blue-600">{activeItem.label}</span>}
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && <div role="menu" aria-label={`${group.label} theme sections`} className="absolute left-0 top-full z-30 mt-1 min-w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                        {group.items.map((item) => <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            aria-current={activeTab === item.id ? 'page' : undefined}
                            onClick={() => selectTab(item.id)}
                            className={`block w-full rounded px-3 py-2 text-left text-sm ${activeTab === item.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                        >{item.label}</button>)}
                    </div>}
                </div>
            })}
        </div>

        <div className="px-4 py-2 md:hidden">
            <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                aria-expanded={mobileOpen}
                aria-controls="theme-editor-mobile-menu"
                className="flex min-h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
            >
                <span className="flex min-w-0 items-center gap-2">
                    {mobileOpen ? <X className="h-4 w-4 shrink-0" /> : <Menu className="h-4 w-4 shrink-0" />}
                    <span>Theme sections</span>
                    {activeItem && <span className="truncate text-xs font-normal text-gray-500">· {activeItem.label}</span>}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileOpen && <div id="theme-editor-mobile-menu" className="mt-2 max-h-[60vh] overflow-y-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                {groups.map((group) => <section key={group.id} className="py-1" aria-labelledby={`theme-menu-${group.id}`}>
                    <h2 id={`theme-menu-${group.id}`} className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400">{group.label}</h2>
                    <div className="space-y-0.5">
                        {group.items.map((item) => <button
                            key={item.id}
                            type="button"
                            aria-current={activeTab === item.id ? 'page' : undefined}
                            onClick={() => selectTab(item.id)}
                            className={`block min-h-10 w-full rounded px-3 py-2 text-left text-sm ${activeTab === item.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                        >{item.label}</button>)}
                    </div>
                </section>)}
            </div>}
        </div>
    </nav>
}

export default ThemeEditorNavigation
