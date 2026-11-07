import React, { useEffect, useRef, useState } from 'react'
import { PreviewLink, formatDisplayDate, value } from './primitives'
import { NewsImageFrame } from './NewsImage'
import { normalizeWidget } from './adapters'
import { newsDetailPresentation } from './newsDetailPresentation'
import { emptyThemeWidgets } from './themeWidgets'
import type { RenderContext, RenderWidgetModel, WidgetRenderComponent } from './types'

export const editorialTemplate = (widget: RenderWidgetModel) => ['columnists', 'events'].includes(value(widget.config, 'displayTemplate', 'display_template'))
export const editorialFeedUrl = (widget: RenderWidgetModel, context: RenderContext, detail = false) => {
    if (!context.siteId) return null
    const kind = value(widget.config, 'displayTemplate', 'display_template')
    const params = new URLSearchParams({ siteId: String(context.siteId), kind,
        eventGroup: value(widget.config, 'eventGroup', 'event_group') || 'all' })
    if (detail) {
        const configured = value(widget.config, 'objectSlug', 'object_slug')
        const variables = context.pathVariables || {}
        const slug = configured || (kind === 'events' ? variables.event_slug || variables.eventSlug : variables.member_slug || variables.memberSlug)
        if (!slug) return null
        params.set('slug', slug)
        params.set('detail', 'true')
    }
    return `/api/editorial?${params}`
}
const basePath = (widget: RenderWidgetModel) => {
    const configured = value(widget.config, 'detailPagePath', 'detail_page_path')
    const fallback = value(widget.config, 'displayTemplate', 'display_template') === 'events' ? '/events' : '/columnists'
    return typeof configured === 'string' && configured.startsWith('/') && !configured.startsWith('//')
        ? configured.split(/[?#]/)[0].replace(/\/$/, '') : fallback
}
const eventDate = (data: Record<string, any>) => {
    const start = data.eventStartDate || data.event_start_date
    const end = data.eventEndDate || data.event_end_date
    return start ? `${formatDisplayDate(start)}${end && end !== start ? ` – ${formatDisplayDate(end)}` : ''}` : ''
}
const ColumnistMetadata = ({ data }: { data: Record<string, any> }) => {
    const latest = data.latestColumn
    const website = data.homePage || data.home_page
    let websiteUrl: URL | null = null
    try { const candidate = new URL(website); if (['http:', 'https:'].includes(candidate.protocol)) websiteUrl = candidate } catch { /* A missing website needs no link. */ }
    return <dl className="editorial-columnist-meta">
        {latest?.slug && latest.title && <div className="editorial-latest-column"><dt>Latest column</dt><dd><PreviewLink href={`/news/${encodeURIComponent(latest.slug)}/`}>{latest.title}</PreviewLink></dd></div>}
        {data.affiliation && <div><dt>Organisation</dt><dd>{data.affiliation}</dd></div>}
        {data.prefix && <div><dt>Title</dt><dd>{data.prefix}</dd></div>}
        {websiteUrl && <div><dt>Website</dt><dd><PreviewLink href={websiteUrl.href} rel="noopener noreferrer">{websiteUrl.hostname}</PreviewLink></dd></div>}
    </dl>
}

export const EditorialListRender: WidgetRenderComponent = props => {
    if (Object.keys(props.context.pathVariables || {}).length && value(props.widget.config, 'hideOnDetailView', 'hide_on_detail_view') !== false) return null
    return <EditorialListContent {...props} />
}
const EditorialListContent: WidgetRenderComponent = ({ widget, context }) => {
    const initial = Array.isArray(widget.data?.items) ? widget.data.items as any[] : []
    const limit = Math.min(5000, Math.max(1, Number(widget.config.limit) || 1000))
    const batch = Math.min(12, limit)
    const source = typeof widget.data?.feedUrl === 'string' ? widget.data.feedUrl : editorialFeedUrl(widget, context)
    const [state, setState] = useState({ items: initial, offset: initial.length, busy: false, error: widget.data?.status === 'error', done: initial.length < batch })
    const pending = useRef(false)
    const generation = useRef(0)
    useEffect(() => {
        generation.current++
        pending.current = false
        setState({ items: initial, offset: initial.length, busy: false, error: widget.data?.status === 'error', done: initial.length < batch })
        return () => { generation.current++ }
    }, [widget.data, source, batch])
    const load = async () => {
        if (!source || pending.current) return
        const current = generation.current
        pending.current = true
        setState(previous => ({ ...previous, busy: true, error: false }))
        try {
            const url = new URL(source, window.location.origin)
            const count = Math.min(batch, limit - state.offset)
            url.searchParams.set('limit', String(count))
            url.searchParams.set('offset', String(state.offset))
            const response = await fetch(url, { credentials: 'omit' })
            if (!response.ok) throw new Error('Unavailable')
            const result = await response.json()
            if (!Array.isArray(result.items)) throw new Error('Invalid response')
            if (current !== generation.current) return
            setState(previous => {
                const ids = new Set(previous.items.map(item => String(item.id)))
                return { items: [...previous.items, ...result.items.filter((item: any) => !ids.has(String(item.id)))], offset: previous.offset + result.items.length, busy: false, error: false, done: result.items.length < count }
            })
        } catch {
            if (current === generation.current) setState(previous => ({ ...previous, busy: false, error: true }))
        } finally { if (current === generation.current) pending.current = false }
    }
    const kind = value(widget.config, 'displayTemplate', 'display_template')
    const compact = kind === 'events' && value(widget.config, 'eventGroup', 'event_group') === 'other'
    const title = kind === 'columnists' ? 'Columnists' : compact ? 'Other events' : 'Eceee events'
    const base = basePath(widget)
    return <section className={`editorial-directory editorial-${kind}${compact ? ' editorial-compact' : ''}`} aria-label={title} aria-busy={state.busy}>
        {kind === 'events' && <h2 className="editorial-section-title">{title}</h2>}
        <div className="editorial-grid">{state.items.map(item => {
            const data = item.data || {}
            return <article className="editorial-card" key={item.id}>
                <h3><PreviewLink href={`${base}/${encodeURIComponent(item.slug)}/`}>{item.title}</PreviewLink></h3>
                {!compact && <div className="editorial-card-body">{kind === 'columnists' ? <ColumnistMetadata data={data} /> : <p>{eventDate(data)}</p>}
                    {data.featuredImage && <NewsImageFrame className="editorial-portrait" source={data.featuredImage} alt="" />}
                </div>}
                {compact && data.featuredImage && <NewsImageFrame className="editorial-portrait" source={data.featuredImage} alt="" />}
            </article>
        })}</div>
        {!state.items.length && !state.error && <p>{widget.data?.status === 'loading' ? 'Loading…' : kind === 'events' ? 'No events available.' : 'No columnists available.'}</p>}
        {state.error && <p role="status">Content could not be loaded.</p>}
        {source && (state.error || (!state.done && state.offset < limit)) && <button type="button" onClick={() => void load()} disabled={state.busy}>{state.busy ? 'Loading…' : state.error ? 'Retry' : 'Load more'}</button>}
    </section>
}

export const EditorialDetailRender: WidgetRenderComponent = ({ widget, context, renderWidgets }) => {
    if (!Object.keys(context.pathVariables || {}).length && !value(widget.config, 'objectId', 'object_id', 'objectSlug', 'object_slug')) return null
    const item: any = widget.data?.item
    if (!item) return <section className="editorial-detail"><p>{widget.data?.status === 'error' ? 'Content could not be loaded.' : 'Content not found.'}</p></section>
    const data = item.data || {}
    const profile = value(widget.config, 'displayTemplate', 'display_template') === 'columnists'
    const slots = Object.fromEntries(Object.entries(item.widgets || {}).map(([key, widgets]) => [key,
        (Array.isArray(widgets) ? widgets : []).map((nested, index) => normalizeWidget(nested, `${key}-${index}`))]))
    const presentation = newsDetailPresentation(item.title || '', '', '', slots, true)
    const date = eventDate(data)
    const url = data.externalUrl || data.external_url
    const body = <div className="editorial-body">{Object.entries(presentation.slots).map(([slot, widgets]) => <div data-slot={slot} data-widget-slot={slot} data-owner-widget-type={widget.type} key={slot}>
        {renderWidgets(widgets, item.themeWidgetTypes || item.theme_widget_types || emptyThemeWidgets())}
    </div>)}</div>
    return <article className={`editorial-detail ${profile ? 'editorial-profile' : 'editorial-event'}`} data-object-id={item.id}>
        {presentation.showHeadline && <h1>{item.title}</h1>}
        {profile && <div className="editorial-profile-layout"><div className="editorial-profile-presentation">
            {body}
            {data.featuredImage && <NewsImageFrame className="editorial-profile-photo" source={data.featuredImage} alt={item.title} />}
        </div><aside className="editorial-profile-metadata" aria-label="About the columnist"><ColumnistMetadata data={data} /></aside></div>}
        {!profile && <dl className="editorial-event-facts">{[
            ['Date', date], ['Time', data.eventTime || data.event_time], ['Organiser', data.organiser], ['Venue', data.venue], ['Focus areas', data.focusAreas || data.focus_areas],
        ].filter(([, content]) => content).map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>}
        {!profile && body}
        {!profile && url && <p><PreviewLink href={url} rel="noopener noreferrer">Event website</PreviewLink></p>}
    </article>
}
