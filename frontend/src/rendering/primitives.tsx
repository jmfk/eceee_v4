import DOMPurify from 'isomorphic-dompurify'
import React from 'react'

export const value = (config: Record<string, any>, ...names: string[]) => {
    for (const name of names) {
        if (config[name] !== undefined && config[name] !== null) return config[name]
    }
    return undefined
}

export const asArray = <T,>(candidate: unknown): T[] => Array.isArray(candidate) ? candidate as T[] : []

export const normalizeCssName = (candidate: string) => String(candidate || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')

export const sanitizeHtml = (html?: string): string => String(DOMPurify.sanitize(String(html || ''), {
    ADD_ATTR: ['loading'],
}))

export const SafeHtml = ({ html, className = '', as: Tag = 'div' }: { html?: string, className?: string, as?: React.ElementType }) => (
    <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
)

export const formatDisplayDate = (candidate: unknown, month: 'long' | 'short' = 'long'): string => {
    const raw = String(candidate || '')
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
    if (!match) return raw
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    return new Intl.DateTimeFormat('en-US', {
        month,
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date)
}

export const normalizeContentMediaHtml = (html?: string): string => {
    const sanitized = sanitizeHtml(html)
    if (typeof document === 'undefined') return sanitized

    const template = document.createElement('template')
    template.innerHTML = sanitized
    template.content.querySelectorAll<HTMLElement>('div[data-media-insert="true"]').forEach((insert) => {
        const image = insert.querySelector('img')
        if (!image) return
        const width = normalizeCssName(insert.dataset.width || 'full')
        const align = normalizeCssName(insert.dataset.align || 'center')
        const figure = document.createElement('figure')
        figure.className = `media-insert img-width-${width} media-align-${align}`
        image.className = `img-width-${width}`
        image.setAttribute('loading', 'lazy')
        figure.appendChild(image)
        const caption = insert.dataset.caption
        if (caption) {
            const figcaption = document.createElement('figcaption')
            figcaption.textContent = caption
            figure.appendChild(figcaption)
        }
        insert.replaceWith(figure)
    })
    return template.innerHTML
}

export const linkHref = (candidate: any): string => {
    if (!candidate) return '#'
    if (typeof candidate === 'string') return candidate
    if (candidate.resolvedUrl || candidate.resolved_url) return candidate.resolvedUrl || candidate.resolved_url
    if (candidate.type === 'external' || candidate.type === 'media') return candidate.url || '#'
    if (candidate.type === 'email') return candidate.address ? `mailto:${candidate.address}` : '#'
    if (candidate.type === 'phone') return candidate.number ? `tel:${String(candidate.number).replace(/[^\d+]/g, '')}` : '#'
    if (candidate.type === 'anchor') return candidate.anchor ? `#${String(candidate.anchor).replace(/^#/, '')}` : '#'
    return candidate.url || candidate.path || '#'
}

export const PreviewLink = ({ href = '#', children, className = '', ...props }: React.PropsWithChildren<{ href?: any, className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props} href={linkHref(href)} className={className}>{children}</a>
)

export const imageUrl = (source: any): string => typeof source === 'string'
    ? source
    : source?.imgproxyBaseUrl || source?.imgproxy_base_url || source?.fileUrl || source?.file_url
        || source?.publicUrl || source?.public_url || source?.absoluteUrl || source?.absolute_url
        || source?.downloadUrl || source?.download_url || source?.thumbnailUrl || source?.thumbnail_url || source?.url || ''

export const googleFontsStylesheetUrl = (fonts: any): string => {
    const families = Array.isArray(fonts?.googleFonts) ? fonts.googleFonts : Array.isArray(fonts?.google_fonts) ? fonts.google_fonts : []
    const query = families.map((font: any) => {
        const family = String(font.family || '').trim().replace(/\s+/g, '+')
        const variants = (Array.isArray(font.variants) ? font.variants : []).map(String).filter((variant: string) => /^\d+$/.test(variant))
        return family ? `family=${family}${variants.length ? `:wght@${variants.join(';')}` : ''}` : ''
    }).filter(Boolean).join('&')
    return query ? `https://fonts.googleapis.com/css2?${query}&display=swap` : ''
}

export const themeStylesheetUrl = (themeId: string | number, theme?: any): string => {
    const updatedAt = theme?.updatedAt || theme?.updated_at
    const version = updatedAt ? Date.parse(updatedAt) : Number.NaN
    return `/api/v1/webpages/themes/${themeId}/styles.css${Number.isNaN(version) ? '' : `?v=${version}`}`
}

export const ImageView = ({ source, alt = '', className = '' }: { source?: any, alt?: string, className?: string }) => {
    const url = imageUrl(source)
    return url ? <img src={url} alt={alt} className={className} /> : null
}

export const TextWithBreaks = ({ children }: { children?: any }) => <>{String(children || '').split(/\r?\n/).map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{line}</React.Fragment>)}</>

export const EmptyRender = ({ children }: React.PropsWithChildren) => (
    <div className="render-empty-state p-4 text-center text-gray-500">{children}</div>
)

export const RenderFailure = ({ message }: { message?: string }) => (
    <div role="alert" className="render-error-state p-4 text-center text-red-600">{message || 'Content could not be rendered.'}</div>
)
