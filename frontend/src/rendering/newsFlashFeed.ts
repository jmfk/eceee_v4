import { useCallback, useEffect, useRef, useState } from 'react'
import { NEWS_FLASH_BATCH, newsFlashLayout } from './newsFlashLayout'
import type { RenderContext, RenderWidgetModel } from './types'

/** Public-only data adapter. The server independently validates host, site and filters. */
export const newsFlashFeedUrl = (widget: RenderWidgetModel, context: RenderContext) => {
    if (typeof widget.data?.feedUrl === 'string') return widget.data.feedUrl
    if (!context.siteId) return null
    const config = widget.config
    const params = new URLSearchParams({ siteId: String(context.siteId), newsFlash: 'true' })
    const types = config.objectTypes ?? config.object_types ?? ['article']
    if (!Array.isArray(types) || !types.length) return null
    types.forEach(type => params.append('type', String(type)))
    const classifications = config.classificationIds ?? config.classification_ids ?? []
    if (Array.isArray(classifications)) classifications.forEach(id => params.append('classificationId', String(id)))
    params.set('includeDescendants', String((config.includeDescendants ?? config.include_descendants) !== false))
    return `/api/news-preview?${params}`
}

export const useNewsFlashFeed = (widget: RenderWidgetModel, context: RenderContext, sourceOverride?: string) => {
    const total = newsFlashLayout(widget.config).total
    const source = sourceOverride ?? newsFlashFeedUrl(widget, context)
    const initial = Array.isArray(widget.data?.items) ? widget.data.items : []
    const [state, setState] = useState({ items: initial, visible: Math.min(total, NEWS_FLASH_BATCH),
        offset: initial.length, priorityId: widget.data?.priorityId as string | null | undefined, busy: false, error: widget.data?.status === 'error',
        exhausted: widget.data?.status === 'empty' || (widget.data?.status === 'ready' && initial.length < Math.min(total, NEWS_FLASH_BATCH)) })
    const generation = useRef(0)
    const busy = useRef(false)
    useEffect(() => {
        generation.current++
        busy.current = false
        setState({ items: initial, visible: Math.min(total, NEWS_FLASH_BATCH), offset: initial.length, priorityId: widget.data?.priorityId as string | null | undefined,
            busy: false, error: widget.data?.status === 'error',
            exhausted: widget.data?.status === 'empty' || (widget.data?.status === 'ready' && initial.length < Math.min(total, NEWS_FLASH_BATCH)) })
        return () => { generation.current++ }
    }, [widget.data, source, total]) // resolved data is replaced when the preview changes
    const load = useCallback(async () => {
        if (busy.current) return
        if (!source || state.exhausted) {
            setState(previous => ({ ...previous, visible: Math.min(total, previous.visible + NEWS_FLASH_BATCH) }))
            return
        }
        if (state.offset >= total) return
        busy.current = true
        const requestGeneration = generation.current
        const limit = Math.min(NEWS_FLASH_BATCH, total - state.offset)
        setState(previous => ({ ...previous, busy: true, error: false, visible: Math.max(previous.visible, Math.min(total, state.offset + limit)) }))
        try {
            const url = new URL(source, window.location.origin)
            url.searchParams.set('limit', String(limit))
            url.searchParams.set('offset', String(state.offset))
            if (state.offset > 0) url.searchParams.set('priorityId', state.priorityId ?? 'none')
            const response = await fetch(url.toString(), { credentials: 'omit' })
            if (!response.ok) throw new Error('News unavailable')
            const result = await response.json()
            if (!Array.isArray(result.items)) throw new Error('Invalid news response')
            if (requestGeneration !== generation.current) return
            setState(previous => {
                const ids = new Set(previous.items.map((item: any) => String(item.id)))
                return { ...previous, items: [...previous.items, ...result.items.filter((item: any) => !ids.has(String(item.id)))],
                    priorityId: result.priorityId ?? null, offset: previous.offset + result.items.length, exhausted: result.items.length < limit, busy: false, error: false }
            })
        } catch {
            if (requestGeneration === generation.current) setState(previous => ({ ...previous, busy: false, error: true }))
        } finally {
            if (requestGeneration === generation.current) busy.current = false
        }
    }, [source, state.offset, state.priorityId, state.exhausted, total])
    useEffect(() => {
        if (!widget.data && source && !state.offset && !state.busy && !state.error && !state.exhausted) void load()
    }, [widget.data, source, state.offset, state.busy, state.error, state.exhausted, load])
    const reveal = useCallback(() => {
        setState(previous => ({ ...previous, visible: Math.min(total, previous.visible + NEWS_FLASH_BATCH) }))
    }, [total])
    const sentinel = useRef<HTMLDivElement>(null)
    const canLoad = state.visible < total || (Boolean(source) && !state.exhausted && state.offset < total)
    useEffect(() => {
        if (!canLoad || state.busy || (state.error && state.visible >= total) || !sentinel.current || typeof IntersectionObserver === 'undefined') return
        const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { if (state.error) reveal(); else void load() } }, { rootMargin: '200px' })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [canLoad, state.error, state.busy, state.visible, total, load, reveal])
    return { ...state, canLoad, load, reveal, sentinel }
}
