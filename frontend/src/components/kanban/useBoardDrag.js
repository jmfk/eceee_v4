import { useEffect, useRef, useState } from 'react'

const edgeSpeed = (coordinate, start, end) => {
    const edge = Math.min(64, (end - start) / 3)
    if (coordinate < start || coordinate > end) return 0
    if (coordinate < start + edge)
        return -Math.ceil(16 * (1 - (coordinate - start) / edge))
    if (coordinate > end - edge)
        return Math.ceil(16 * (1 - (end - coordinate) / edge))
    return 0
}

export default function useBoardDrag(scope) {
    const boardRef = useRef(null)
    const dragRef = useRef(null)
    const targetRef = useRef(null)
    const pointerRef = useRef(null)
    const ghostRef = useRef(null)
    const [drag, setDrag] = useState(null)
    const [target, setTarget] = useState(null)
    const clear = () => {
        dragRef.current = null
        targetRef.current = null
        pointerRef.current = null
        ghostRef.current?.remove()
        ghostRef.current = null
        setDrag(null)
        setTarget(null)
    }
    const locate = (x, y) => {
        const board = boardRef.current
        const active = dragRef.current
        if (!board || !active) return
        const sections = [...board.querySelectorAll(':scope > .kb-column')]
        let next = null
        if (active.type === 'column') {
            const index = sections.findIndex(
                (section) =>
                    x <
                    section.getBoundingClientRect().left +
                        section.offsetWidth / 2,
            )
            next = { index: index < 0 ? sections.length : index }
        } else {
            const section = sections.find((section) => {
                const rect = section.getBoundingClientRect()
                return x >= rect.left && x <= rect.right
            })
            if (section) {
                const before = [
                    ...section.querySelectorAll(':scope > .kb-card'),
                ].find(
                    (card) =>
                        card.dataset.cardId !== active.id &&
                        y <
                            card.getBoundingClientRect().top +
                                card.offsetHeight * 0.65,
                )
                next = {
                    column: section.dataset.columnId,
                    before: before?.dataset.cardId || null,
                    position: before
                        ? Number(before.dataset.position)
                        : 2147483647,
                }
            }
        }
        if (JSON.stringify(next) !== JSON.stringify(targetRef.current)) {
            targetRef.current = next
            setTarget(next)
        }
    }
    const start = (event, payload) => {
        if (
            event.target.closest(
                'button, input, select, textarea, [data-headlessui-state]',
            )
        ) {
            event.preventDefault()
            return
        }
        event.stopPropagation()
        const source =
            payload.type === 'column'
                ? event.currentTarget.closest('.kb-column')
                : event.currentTarget
        const rect = source.getBoundingClientRect()
        const ghost = source.cloneNode(true)
        ghost.classList.add('kb-drag-ghost')
        ghost.style.cssText = `position:fixed;left:-10000px;top:0;width:${rect.width}px;max-height:none;height:${source.scrollHeight}px;overflow:hidden;pointer-events:none;`
        ghost
            .querySelectorAll('[id]')
            .forEach((node) => node.removeAttribute('id'))
        document.body.appendChild(ghost)
        ghostRef.current = ghost
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(
            'application/kanban',
            JSON.stringify(payload),
        )
        event.dataTransfer.setDragImage(
            ghost,
            Math.min(event.clientX - rect.left, rect.width),
            Math.min(event.clientY - rect.top, rect.height),
        )
        const active = { ...payload, height: rect.height }
        dragRef.current = active
        setDrag(active)
    }
    useEffect(() => {
        let frame
        const over = (event) => {
            if (!dragRef.current) return
            const rect = boardRef.current?.getBoundingClientRect()
            if (
                !rect ||
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
            ) {
                pointerRef.current = null
                targetRef.current = null
                setTarget(null)
                return
            }
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            pointerRef.current = { x: event.clientX, y: event.clientY }
            locate(event.clientX, event.clientY)
            if (!frame) frame = requestAnimationFrame(tick)
        }
        const tick = () => {
            frame = null
            const board = boardRef.current
            const point = pointerRef.current
            if (dragRef.current && board && point) {
                const rect = board.getBoundingClientRect()
                board.scrollLeft += edgeSpeed(point.x, rect.left, rect.right)
                board.scrollTop += edgeSpeed(point.y, rect.top, rect.bottom)
                if (dragRef.current.type === 'card') {
                    const column = [
                        ...board.querySelectorAll(':scope > .kb-column'),
                    ].find((item) => {
                        const bounds = item.getBoundingClientRect()
                        return point.x >= bounds.left && point.x <= bounds.right
                    })
                    if (column) {
                        const bounds = column.getBoundingClientRect()
                        const bottom = Math.min(bounds.bottom, rect.bottom)
                        column.scrollTop += edgeSpeed(Math.min(point.y, bottom), bounds.top, bottom)
                    }
                }
                locate(point.x, point.y)
            }
            if (dragRef.current) frame = requestAnimationFrame(tick)
        }
        window.addEventListener('dragover', over)
        window.addEventListener('dragend', clear)
        window.addEventListener('drop', clear)
        const escape = (event) => {
            if (event.key === 'Escape') clear()
        }
        window.addEventListener('keydown', escape)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('dragover', over)
            window.removeEventListener('dragend', clear)
            window.removeEventListener('drop', clear)
            window.removeEventListener('keydown', escape)
            ghostRef.current?.remove()
            dragRef.current = null
            pointerRef.current = null
            targetRef.current = null
        }
    }, [scope]) // The board DOM is read on each frame; no card data is captured.
    return { boardRef, drag, target, targetRef, start, clear }
}
