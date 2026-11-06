import React from 'react'
import { value } from './primitives'
import { NewsFlashCard, NewsFlashPlaceholder } from './NewsFlashCard'
import { newsFlashLayout } from './newsFlashLayout'
import { useNewsFlashFeed } from './newsFlashFeed'
import type { WidgetRenderComponent } from './types'

export const NewsFlashRender: WidgetRenderComponent = ({ widget, context }) => {
    const layout = newsFlashLayout(widget.config)
    const feed = useNewsFlashFeed(widget, context)
    const configuredPath = value(widget.config, 'newsPagePath', 'news_page_path') ?? '/news/'
    const base = typeof configuredPath === 'string' && configuredPath.startsWith('/') && !configuredPath.startsWith('//')
        ? configuredPath.split(/[?#]/)[0].replace(/\/$/, '') : '/news'
    const showExcerpts = value(widget.config, 'showExcerpts', 'show_excerpts') !== false
    const loading = feed.busy || (widget.data?.status === 'loading' && !feed.offset && !feed.exhausted && !feed.error)
    return <section className="news-flash-widget" aria-label="News Flash" data-widget-type="news-flash" aria-busy={loading}>
        <div className="news-flash-grid">
            {Array.from({ length: feed.visible }, (_, index) => feed.items[index]
                ? <NewsFlashCard key={index} item={feed.items[index] as Record<string, any>} size={layout.size(index)} base={base} showExcerpts={showExcerpts} />
                : <NewsFlashPlaceholder key={index} index={index} size={layout.size(index)} loading={loading} />)}
        </div>
        {feed.error && <p role="status">News could not be loaded.</p>}
        {feed.canLoad && <div ref={feed.sentinel} className="news-flash-more">
            {feed.error && feed.visible < layout.total && <button type="button" onClick={feed.reveal}>Show more news placeholders</button>}
            <button type="button" onClick={() => void feed.load()} disabled={feed.busy}>{feed.busy ? 'Loading news…' : feed.error ? 'Retry loading news' : feed.exhausted ? 'Show more news placeholders' : 'Load more news'}</button>
        </div>}
    </section>
}
