import React from 'react'
import { Newspaper } from 'lucide-react'

/** Editing controls stay separate from the public renderer and resolved news data. */
const NewsFlashWidget = ({ widgetId }: { widgetId?: string, config?: Record<string, unknown>, mode?: string }) => (
    <div className="news-flash-widget-editor border border-dashed border-gray-300 bg-gray-50 p-5" data-widget-id={widgetId}>
        <div className="flex items-center gap-2 font-medium text-gray-900"><Newspaper size={18} aria-hidden="true" />News Flash</div>
        <p className="mt-2 text-sm text-gray-600">Three published stories: one lead story and two smaller stories. Open Preview to see the news.</p>
    </div>
)

NewsFlashWidget.displayName = 'News Flash'
NewsFlashWidget.widgetType = 'easy_widgets.NewsFlashWidget'
NewsFlashWidget.defaultConfig = { objectTypes: ['article'], limit: 3, newsPagePath: '/news/', showExcerpts: true }
NewsFlashWidget.metadata = {
    name: 'News Flash', description: 'Three stories with a large lead and two compact supporting stories',
    category: 'content', icon: Newspaper, tags: ['news', 'homepage', 'featured'], menuItems: [],
}

export default NewsFlashWidget
