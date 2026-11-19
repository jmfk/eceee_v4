import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Film, Play } from 'lucide-react'
import { supportRequest } from '../../api/support'
import { useSupportIdentity, useSupportTenant } from './useSupportContext'

export default function PrivateVideoThumbnail({ id }: { id?: string }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const host = useRef<HTMLSpanElement>(null)
    const [visible, setVisible] = useState(false)
    const [ready, setReady] = useState(false)
    const [failed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        if (!host.current || !id) return
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true)
            return
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisible(true)
                observer.disconnect()
            }
        }, { rootMargin: '160px' })
        observer.observe(host.current)
        return () => observer.disconnect()
    }, [id])
    const video = useQuery<{ url: string }>({
        queryKey: ['support', tenant, identity, 'thumbnail', id, attempt],
        queryFn: () => supportRequest(tenant, `videos/${id}/playback/`),
        enabled: visible && !!id,
        // Signed URLs stay in memory only and are discarded when the row leaves.
        gcTime: 0,
        staleTime: 45000,
        refetchOnWindowFocus: false,
        retry: false,
    })
    const seekFrame = (event: SyntheticEvent<HTMLVideoElement>) => {
        const element = event.currentTarget
        if (Number.isFinite(element.duration) && element.duration > 0) {
            // A paused frame avoids copying private media to public poster storage.
            element.currentTime = Math.min(30, element.duration * 0.4)
        }
    }
    return (
        <span className="instruction-thumbnail" ref={host} aria-hidden="true">
            <Film className="instruction-thumbnail-placeholder" size={28} />
            {video.data && !failed && (
                <video
                    key={`${video.data.url}:${attempt}`}
                    src={video.data.url}
                    className={ready ? 'is-ready' : ''}
                    muted
                    playsInline
                    preload="metadata"
                    tabIndex={-1}
                    disablePictureInPicture
                    onLoadedMetadata={seekFrame}
                    onSeeked={() => setReady(true)}
                    onError={() => {
                        setReady(false)
                        if (attempt < 1) setAttempt(1)
                        else setFailed(true)
                    }}
                />
            )}
            <span className="instruction-thumbnail-play"><Play size={18} fill="currentColor" /></span>
        </span>
    )
}
