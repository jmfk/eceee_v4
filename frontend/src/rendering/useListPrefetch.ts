import { useEffect, useRef, useState } from 'react'

/** Prefetch one page near the list end. Tab navigation keeps a stable end to the list. */
export function useListPrefetch(enabled: boolean, load: () => void) {
    const marker = useRef<HTMLDivElement>(null)
    const tabbing = useRef(false)
    const [buttonFocused, setButtonFocused] = useState(false)

    useEffect(() => {
        const target = marker.current
        if (!target || typeof IntersectionObserver === 'undefined') return

        let observer: IntersectionObserver | undefined
        const observe = () => {
            observer?.disconnect()
            observer = undefined
            if (!enabled || tabbing.current) return
            const next = new IntersectionObserver(entries => {
                if (observer !== next || tabbing.current) return
                if (entries.some(entry => entry.isIntersecting)) load()
            }, { rootMargin: `0px 0px ${Math.ceil(window.innerHeight * 2)}px 0px` })
            observer = next
            observer.observe(target)
        }
        const resume = () => {
            if (!tabbing.current) return
            tabbing.current = false
            observe()
        }
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                tabbing.current = true
                observe()
            } else if (['PageDown', 'PageUp', 'End', 'Home', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)
                && !(event.target instanceof HTMLElement && event.target.closest('input, select, textarea, button, [contenteditable]'))) {
                resume()
            }
        }
        observe()
        window.addEventListener('keydown', handleKey, true)
        window.addEventListener('wheel', resume, { passive: true })
        window.addEventListener('touchmove', resume, { passive: true })
        window.addEventListener('resize', observe)
        return () => {
            observer?.disconnect()
            observer = undefined
            window.removeEventListener('keydown', handleKey, true)
            window.removeEventListener('wheel', resume)
            window.removeEventListener('touchmove', resume)
            window.removeEventListener('resize', observe)
        }
    }, [enabled, load])

    return {
        marker,
        buttonFocused,
        onButtonFocus: () => setButtonFocused(true),
        onButtonBlur: () => setButtonFocused(false),
    }
}
