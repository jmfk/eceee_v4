import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supportRequest, supportError } from '../../api/support'
import { useSupportTenant, useSupportIdentity } from './useSupportContext'

export default function PrivateVideoPlayer({ id }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const [attempt, setAttempt] = useState(0)
    const player = useRef(null)
    const resume = useRef({ time: 0, playing: false })
    const renew = () => {
        if (player.current)
            resume.current = {
                time: player.current.currentTime,
                playing: !player.current.paused,
            }
        setAttempt((n) => n + 1)
    }
    const video = useQuery({
        queryKey: ['support', tenant, identity, 'playback', id, attempt],
        queryFn: () => supportRequest(tenant, `videos/${id}/playback/`),
        enabled: !!id,
        staleTime: 0,
        gcTime: 0,
        retry: false,
    })
    if (!id) return null
    return (
        <section aria-label="Video">
            {video.error && <p role="alert" className="text-red-700">{supportError(video.error)}</p>}
            {video.isPending ? (
                <p role="status">Öppnar privat video…</p>
            ) : (
                video.data && (
                    <video
                        className="my-4 max-h-[440px] w-full rounded-lg bg-gray-900"
                        ref={player}
                        key={video.data.url}
                        src={video.data.url}
                        onLoadedMetadata={() => {
                            if (!player.current) return
                            player.current.currentTime = resume.current.time
                            if (resume.current.playing)
                                player.current.play().catch(() => {})
                        }}
                        controls
                        preload="metadata"
                        onError={() => {
                            if (attempt < 1) renew()
                        }}
                    />
                )
            )}
            <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={renew}>Förnya uppspelningen</button>
            <p className="mt-2 text-sm text-gray-500">
                Om länken har löpt ut, förnya uppspelningen.
            </p>
        </section>
    )
}
