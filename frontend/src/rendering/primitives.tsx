import DOMPurify from 'dompurify'
import React from 'react'

export const value = (config: Record<string, any>, ...names: string[]) => {
    for (const name of names) {
        if (config[name] !== undefined && config[name] !== null) return config[name]
    }
    return undefined
}

export const asArray = <T,>(candidate: T[] | null | undefined): T[] => Array.isArray(candidate) ? candidate : []

export const normalizeCssName = (candidate: string) => String(candidate || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')

export const SafeHtml = ({ html, className = '', as: Tag = 'div' }: { html?: string, className?: string, as?: keyof JSX.IntrinsicElements }) => (
    <Tag className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(html || '')) }} />
)

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
