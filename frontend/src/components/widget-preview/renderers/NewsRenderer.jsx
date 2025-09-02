import React from 'react'

/**
 * NewsRenderer - React renderer for News widgets
 */
const NewsRenderer = ({ configuration }) => {
  const {
    title = 'Latest News',
    items_count = 3,
    category = '',
    show_date = true,
    show_summary = true,
    css_class = ''
  } = configuration

  // Mock news items for preview
  const mockNews = Array.from({ length: items_count }, (_, i) => ({
    id: i + 1,
    title: `News Article ${i + 1}`,
    summary: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
    category: category || 'General'
  }))

  return (
    <div className={`news-widget ${css_class}`}>
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      
      <div className="space-y-4">
        {mockNews.map(item => (
          <article key={item.id} className="news-item border-b pb-4">
            <h4 className="text-lg font-semibold text-blue-600 hover:underline cursor-pointer">
              {item.title}
            </h4>
            {show_date && (
              <time className="text-sm text-gray-500">{item.date}</time>
            )}
            {show_summary && (
              <p className="text-gray-700 mt-2">{item.summary}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

export default NewsRenderer