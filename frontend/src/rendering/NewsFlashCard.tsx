import React, { useState } from 'react'
import { PreviewLink, imageUrl } from './primitives'
import { NewsImage, newsImageDimensions } from './NewsImage'

/** Small presentation primitive shared with the editor's layout placeholders. */
export const NewsFlashPlaceholder = ({ index, size, loading = false, editor = false, imageShape = 'landscape' }: { imageShape?: string; index: number; size: string; loading?: boolean; editor?: boolean }) => (
    <article className={`news-flash-story news-flash-${size} news-flash-placeholder news-flash-image-${imageShape}${size === 'full' ? ' news-flash-lead' : ''}`} aria-label={`News ${index + 1} placeholder`}>
        <h3 className="news-flash-title">News {index + 1}</h3>
        <div className="news-flash-body">
            <div className="news-flash-copy">
                <p className="news-flash-placeholder-label">{editor ? 'Published story' : loading ? 'Loading news…' : 'News unavailable'}</p>
            </div>
            <div className="news-flash-image news-flash-placeholder-image" aria-hidden="true" />
        </div>
    </article>
)

export const NewsFlashCard = ({ item, size, base, showExcerpts, imageShape = 'landscape' }: { imageShape?: string; item: Record<string, any>; size: string; base: string; showExcerpts: boolean }) => {
    const data = item.data || {}
    const image = data.featuredImage || data.featured_image || item.featuredImage || item.featured_image || item.image
    const url = image?.src || imageUrl(image)
    const [loaded, setLoaded] = useState<{ url: string; width: number; height: number } | null>(null)
    const dimensions = newsImageDimensions(image) || (loaded?.url === url ? loaded : null)
    const sourceShape = dimensions ? dimensions.width > dimensions.height ? 'landscape' : 'square' : imageShape
    const hasImage = Boolean(url)
    const source = data.summary || data.excerpt || data.description || item.summary || item.excerpt || ''
    const excerpt = String(source).replace(/<[^>]*>/g, '').trim()
    return <article className={`news-flash-story news-flash-${size} news-flash-image-${sourceShape}${size === 'full' ? ' news-flash-lead' : ''} ${hasImage ? 'has-image' : 'no-image'}`} data-object-id={item.id}>
        <h3 className="news-flash-title">{item.slug
            ? <PreviewLink href={`${base}/${encodeURIComponent(item.slug)}/`}>{item.title}</PreviewLink> : item.title}</h3>
        <div className="news-flash-body">
            <div className="news-flash-copy">{showExcerpts && excerpt && <p className="news-flash-excerpt">{excerpt}</p>}</div>
            {hasImage && <div className="news-flash-image"><NewsImage key={url} source={image} alt="" onDimensions={size => setLoaded({ url, ...size })} /></div>}
        </div>
    </article>
}
