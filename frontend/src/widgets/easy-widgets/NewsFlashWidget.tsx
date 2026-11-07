import React, { useMemo } from 'react'
import { Newspaper } from 'lucide-react'
import { NewsFlashCard, NewsFlashPlaceholder } from '../../rendering/NewsFlashCard'
import { newsFlashLayout, newsFlashImageShape } from '../../rendering/newsFlashLayout'
import { newsFlashFeedUrl, useNewsFlashFeed } from '../../rendering/newsFlashFeed'
import { newsPreviewOrigin } from '../../utils/newsPreviewOrigin'
import manifest from '../../rendering/generated/render-manifest.json'

const emptyConfig: Record<string, any> = {}
const emptyContext: Record<string, any> = {}

/** Read published stories while keeping editing controls outside the public renderer. */
const NewsFlashWidget = ({ widgetId, config = emptyConfig, context = emptyContext }: { widgetId?: string, config?: Record<string, any>, mode?: string, context?: Record<string, any> }) => {
    const page = context.webpageData
    const siteId = page?.cachedRootId || page?.cached_root_id || (!page?.parentId && !page?.parent_id ? page?.id : undefined)
    const hostnames = page?.hostnames?.length ? page.hostnames : page?.cachedRootHostnames || page?.cached_root_hostnames
    const widget = useMemo(() => {
        const model = { id: widgetId || 'news-flash', type: 'easy_widgets.NewsFlashWidget', config }
        if (!siteId || !hostnames?.length) return { ...model, data: { status: 'empty' as const, items: [] } }
        try {
            const path = newsFlashFeedUrl(model, { siteId, preview: true, pathVariables: context.pathVariables || context.path_variables || {} })
            return path ? { ...model, data: undefined, feedUrl: `${newsPreviewOrigin(hostnames)}${path}` } : model
        } catch { return { ...model, data: { status: 'error' as const, items: [] } } }
    }, [widgetId, config, siteId, hostnames, context.pathVariables, context.path_variables])
    const feedContext = useMemo(() => ({ siteId, preview: true, pathVariables: context.pathVariables || context.path_variables || {} }), [siteId, context.pathVariables, context.path_variables])
    const feed = useNewsFlashFeed(widget, feedContext, 'feedUrl' in widget ? widget.feedUrl as string : undefined)
    const layout = newsFlashLayout(config)
    const path = config.newsPagePath ?? config.news_page_path ?? '/news/'
    const base = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path.split(/[?#]/)[0].replace(/\/$/, '') : '/news'
    return <div className="news-flash-widget-editor" data-widget-id={widgetId} onClick={event => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault()
    }}>
        <style>{manifest.widgets['easy_widgets.NewsFlashWidget'].css}</style>
        <section className="news-flash-widget" aria-label="News Flash" aria-busy={feed.loading}>
            <div className="news-flash-grid">{Array.from({ length: feed.visible }, (_, index) => feed.items[index]
                ? <NewsFlashCard key={index} item={feed.items[index] as Record<string, any>} size={layout.size(index)} imageShape={newsFlashImageShape(config)} base={base} showExcerpts={(config.showExcerpts ?? config.show_excerpts) !== false} />
                : <NewsFlashPlaceholder key={index} index={index} size={layout.size(index)} imageShape={newsFlashImageShape(config)} loading={feed.loading} />)}</div>
            {feed.error && <p role="status">News could not be loaded.</p>}
            {feed.canLoad && <div ref={feed.sentinel} className="news-flash-more"><button type="button" disabled={feed.busy} onClick={() => void feed.load()}>{feed.busy ? 'Loading news…' : feed.error ? 'Retry loading news' : 'Load more news'}</button></div>}
        </section>
    </div>
}

NewsFlashWidget.displayName = 'News Flash'
NewsFlashWidget.widgetType = 'easy_widgets.NewsFlashWidget'
NewsFlashWidget.defaultConfig = { objectTypes: ['article'], imageShape: 'landscape', fullWidthCount: 1, halfWidthCount: 2, thirdWidthCount: 0, newsPagePath: '/news/', showExcerpts: true }
NewsFlashWidget.metadata = {
    name: 'News Flash', description: 'Published news in full, half and third-width layouts',
    category: 'content', icon: Newspaper, tags: ['news', 'homepage', 'featured'], menuItems: [],
}
export default NewsFlashWidget
