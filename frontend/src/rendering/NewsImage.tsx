import React, { useEffect, useRef, useState } from 'react'
import { getFocalCropStyle } from '../components/media/focalCrop'
import { imageUrl } from './primitives'

export const newsImageDimensions = (source: any) => {
    const width = Number(source?.originalWidth ?? source?.original_width ?? source?.width)
    const height = Number(source?.originalHeight ?? source?.original_height ?? source?.height)
    return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? { width, height } : null
}
export const newsImageFocalPoint = (source: any) => {
    const point = source?.focalPoint ?? source?.focal_point ?? source?.metadata?.focalPoint ?? source?.metadata?.focal_point
    const axis = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5
    return { x: axis(point?.x), y: axis(point?.y) }
}

/** Use the same bounded focal crop as the media library, at the actual frame size. */
export const NewsImage = ({ source, alt = '', onDimensions }: { source: any; alt?: string; onDimensions?: (size: { width: number; height: number }) => void }) => {
    const src = source?.src || imageUrl(source)
    const ref = useRef<HTMLImageElement>(null)
    const [loaded, setLoaded] = useState<{ src: string; width: number; height: number } | null>(null)
    const [frame, setFrame] = useState({ width: 0, height: 0 })
    const dimensions = loaded?.src === src ? loaded : newsImageDimensions(source)
    const point = newsImageFocalPoint(source)
    useEffect(() => {
        const element = ref.current?.parentElement
        if (!element) return
        const measure = () => {
            const rect = element.getBoundingClientRect()
            setFrame({ width: rect.width || element.clientWidth, height: rect.height || element.clientHeight })
        }
        measure()
        const image = ref.current
        if (image?.complete && image.naturalWidth && image.naturalHeight) {
            const size = { width: image.naturalWidth, height: image.naturalHeight }
            setLoaded({ src, ...size })
            onDimensions?.(size)
        }
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(measure)
            observer.observe(element)
            return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [src])
    const crop = dimensions ? getFocalCropStyle(dimensions, frame, point, 0) : null
    return src ? <img ref={ref} src={src} srcSet={source?.srcSet || source?.srcset} alt={alt}
        style={crop ? { position: 'absolute', ...crop, maxWidth: 'none', objectFit: 'cover' } : { objectFit: 'cover', objectPosition: `${point.x * 100}% ${point.y * 100}%` }}
        onLoad={event => {
            const image = event.currentTarget
            if (image.naturalWidth && image.naturalHeight) {
                const size = { width: image.naturalWidth, height: image.naturalHeight }
                setLoaded({ src, ...size })
                onDimensions?.(size)
            }
        }} /> : null
}

/** Frames for the other cropped news lists share source-shape and focal behaviour. */
export const NewsImageFrame = ({ source, alt = '', className = '' }: { source: any; alt?: string; className?: string }) => {
    const url = source?.src || imageUrl(source)
    const [loaded, setLoaded] = useState<{ url: string; width: number; height: number } | null>(null)
    const dimensions = newsImageDimensions(source) || (loaded?.url === url ? loaded : null)
    const shape = dimensions && dimensions.width <= dimensions.height ? 'square' : 'landscape'
    return url ? <div className={`${className} news-image-${shape}`}>
        <NewsImage key={url} source={source} alt={alt} onDimensions={size => setLoaded({ url, ...size })} />
    </div> : null
}
