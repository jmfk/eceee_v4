import { useEffect, useRef } from 'react'

export default function ImageVersionContextMenu({ position, onUpload, onClose }) {
    const menuRef = useRef(null)

    useEffect(() => {
        if (!position) return
        const dismiss = event => { if (!menuRef.current?.contains(event.target)) onClose() }
        const escape = event => { if (event.key === 'Escape') onClose() }
        document.addEventListener('pointerdown', dismiss)
        document.addEventListener('keydown', escape)
        menuRef.current?.querySelector('button')?.focus()
        return () => {
            document.removeEventListener('pointerdown', dismiss)
            document.removeEventListener('keydown', escape)
        }
    }, [position, onClose])

    if (!position) return null
    return <div ref={menuRef} role="menu" aria-label="Image actions"
        className="fixed z-[70] min-w-48 rounded border border-gray-200 bg-white p-1 text-xs shadow-lg"
        style={{ left: Math.min(position.x, window.innerWidth - 210), top: Math.min(position.y, window.innerHeight - 60) }}>
        <button type="button" role="menuitem" onClick={onUpload}
            className="w-full rounded px-3 py-2 text-left text-gray-900 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            Upload new version
        </button>
    </div>
}
