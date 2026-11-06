import React, { useEffect, useRef, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { NewsFlashPlaceholder } from '../../rendering/NewsFlashCard'
import { NEWS_FLASH_BATCH, newsFlashLayout } from '../../rendering/newsFlashLayout'
import manifest from '../../rendering/generated/render-manifest.json'

/** Slot editing shows the configured layout without fabricating published stories. */
const NewsFlashWidget = ({ widgetId, config = {} }: { widgetId?: string, config?: Record<string, unknown>, mode?: string }) => {
    const layout = newsFlashLayout(config)
    const [visible, setVisible] = useState(NEWS_FLASH_BATCH)
    const sentinel = useRef<HTMLDivElement>(null)
    useEffect(() => { setVisible(NEWS_FLASH_BATCH) }, [layout.total])
    useEffect(() => {
        if (visible >= layout.total || !sentinel.current || typeof IntersectionObserver === 'undefined') return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) setVisible(count => Math.min(layout.total, count + NEWS_FLASH_BATCH))
        })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [visible, layout.total])
    return <div className="news-flash-widget-editor" data-widget-id={widgetId}>
        <style>{manifest.widgets['easy_widgets.NewsFlashWidget'].css}</style>
        <section className="news-flash-widget" aria-label="News Flash layout">
            <div className="news-flash-grid">{Array.from({ length: Math.min(visible, layout.total) }, (_, index) =>
                <NewsFlashPlaceholder key={index} index={index} size={layout.size(index)} editor />)}</div>
            {visible < layout.total && <div ref={sentinel} className="news-flash-more"><button type="button" onClick={() => setVisible(count => count + NEWS_FLASH_BATCH)}>Show more placeholders</button></div>}
        </section>
    </div>
}

NewsFlashWidget.displayName = 'News Flash'
NewsFlashWidget.widgetType = 'easy_widgets.NewsFlashWidget'
NewsFlashWidget.defaultConfig = { objectTypes: ['article'], fullWidthCount: 1, halfWidthCount: 2, thirdWidthCount: 0, newsPagePath: '/news/', showExcerpts: true }
NewsFlashWidget.metadata = {
    name: 'News Flash', description: 'Published news in full, half and third-width layouts',
    category: 'content', icon: Newspaper, tags: ['news', 'homepage', 'featured'], menuItems: [],
}
export default NewsFlashWidget
