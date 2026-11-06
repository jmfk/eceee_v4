import React from 'react'
import { EmptyRender, ImageView, PreviewLink, RenderFailure, imageUrl, value } from './primitives'
import type { WidgetRenderComponent } from './types'

export const NewsFlashRender: WidgetRenderComponent = ({ widget }) => {
    if (widget.data?.status === 'loading') return <EmptyRender>Loading news…</EmptyRender>
    if (widget.data?.status === 'error') return <RenderFailure message="News could not be loaded." />
    const items = Array.isArray(widget.data?.items) ? widget.data.items.slice(0, 3) : []
    if (!items.length) return <EmptyRender>No published news available.</EmptyRender>
    const config = widget.config
    const configuredPath = value(config, 'newsPagePath', 'news_page_path') ?? '/news/'
    const base = typeof configuredPath === 'string' && configuredPath.startsWith('/') && !configuredPath.startsWith('//')
        ? configuredPath.split(/[?#]/)[0].replace(/\/$/, '') : '/news'
    const showExcerpts = value(config, 'showExcerpts', 'show_excerpts') !== false

    return <section className="news-flash-widget" aria-label="News Flash" data-widget-type="news-flash">
        <div className="news-flash-grid">
            {items.map((raw, index) => {
                const item = raw as Record<string, any>
                const data = item.data || {}
                const image = data.featuredImage || data.featured_image || item.featuredImage || item.featured_image || item.image
                const hasImage = Boolean(image?.src || imageUrl(image))
                const source = data.summary || data.excerpt || data.description || item.summary || item.excerpt || ''
                const excerpt = String(source).replace(/<[^>]*>/g, '').trim()
                const href = item.slug ? `${base}/${encodeURIComponent(item.slug)}/` : '#'
                return <article className={`news-flash-story${index === 0 ? ' news-flash-lead' : ''}${hasImage ? ' has-image' : ''}`} key={item.id || index} data-object-id={item.id}>
                    <div className="news-flash-copy">
                        <h3 className="news-flash-title"><PreviewLink href={href}>{item.title}</PreviewLink></h3>
                        {showExcerpts && excerpt && <p className="news-flash-excerpt">{excerpt}</p>}
                    </div>
                    {hasImage && <div className="news-flash-image"><ImageView source={image} alt="" /></div>}
                </article>
            })}
        </div>
    </section>
}
