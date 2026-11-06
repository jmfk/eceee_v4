import React from 'react'
import { ImageView, PreviewLink, imageUrl } from './primitives'

/** Small presentation primitive shared with the editor's layout placeholders. */
export const NewsFlashPlaceholder = ({ index, size, loading = false, editor = false }: { index: number; size: string; loading?: boolean; editor?: boolean }) => (
    <article className={`news-flash-story news-flash-${size} news-flash-placeholder${size === 'full' ? ' news-flash-lead' : ''}`} aria-label={`News ${index + 1} placeholder`}>
        <div className="news-flash-copy"><h3 className="news-flash-title">News {index + 1}</h3>
            <p className="news-flash-placeholder-label">{editor ? 'Published story' : loading ? 'Loading news…' : 'News unavailable'}</p>
            <div className="news-flash-placeholder-lines" aria-hidden="true"><span /><span /></div>
        </div>
        <div className="news-flash-image news-flash-placeholder-image" aria-hidden="true" />
    </article>
)

export const NewsFlashCard = ({ item, size, base, showExcerpts }: { item: Record<string, any>; size: string; base: string; showExcerpts: boolean }) => {
    const data = item.data || {}
    const image = data.featuredImage || data.featured_image || item.featuredImage || item.featured_image || item.image
    const hasImage = Boolean(image?.src || imageUrl(image))
    const source = data.summary || data.excerpt || data.description || item.summary || item.excerpt || ''
    const excerpt = String(source).replace(/<[^>]*>/g, '').trim()
    return <article className={`news-flash-story news-flash-${size}${size === 'full' ? ' news-flash-lead' : ''}${hasImage ? ' has-image' : ''}`} data-object-id={item.id}>
        <div className="news-flash-copy"><h3 className="news-flash-title">{item.slug
            ? <PreviewLink href={`${base}/${encodeURIComponent(item.slug)}/`}>{item.title}</PreviewLink> : item.title}</h3>
            {showExcerpts && excerpt && <p className="news-flash-excerpt">{excerpt}</p>}
        </div>
        {hasImage && <div className="news-flash-image"><ImageView source={image} alt="" /></div>}
    </article>
}
