import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

const FieldHelpPopover = ({ children, id, label = 'field' }) => {
    const generatedId = useId()
    const popoverId = id || `field-help-${generatedId}`
    const [isOpen, setIsOpen] = useState(false)
    const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 })
    const containerRef = useRef(null)
    const buttonRef = useRef(null)
    const popoverRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return undefined

        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                buttonRef.current?.focus()
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen])

    useLayoutEffect(() => {
        if (!isOpen || !buttonRef.current || !popoverRef.current) return undefined

        const updatePosition = () => {
            const buttonRect = buttonRef.current.getBoundingClientRect()
            const popoverRect = popoverRef.current.getBoundingClientRect()
            const viewportPadding = 16
            const gap = 8
            const maxLeft = window.innerWidth - popoverRect.width - viewportPadding
            const left = Math.max(viewportPadding, Math.min(buttonRect.left, maxLeft))
            const hasRoomBelow = buttonRect.bottom + gap + popoverRect.height <= window.innerHeight - viewportPadding
            const top = hasRoomBelow
                ? buttonRect.bottom + gap
                : Math.max(viewportPadding, buttonRect.top - popoverRect.height - gap)

            setPopoverPosition({ left, top })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)
        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [isOpen])

    if (!children) return null

    return (
        <span ref={containerRef} className="relative inline-flex">
            <button
                ref={buttonRef}
                type="button"
                aria-label={`About ${label}`}
                aria-expanded={isOpen}
                aria-controls={popoverId}
                onClick={() => setIsOpen((open) => !open)}
                onBlur={() => setIsOpen(false)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
                <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen ? createPortal(
                <span
                    ref={popoverRef}
                    id={popoverId}
                    role="note"
                    className="fixed z-[10020] w-64 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-700 shadow-lg"
                    style={popoverPosition}
                >
                    {children}
                </span>,
                document.body
            ) : (
                <span id={popoverId} role="note" className="sr-only">
                    {children}
                </span>
            )}
        </span>
    )
}

export default FieldHelpPopover
