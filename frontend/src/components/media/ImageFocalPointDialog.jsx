import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { mediaApi } from '../../api'
import { getImgproxyUrl } from '../../utils/imgproxySecure'
import { extractErrorMessage } from '../../utils/errorHandling'
import { getFocalCropStyle } from './focalCrop'

const CENTER = { x: 0.5, y: 0.5 }
const clamp = value => Math.max(0, Math.min(1, value))

const previewShapes = [
    { label: 'Landscape', className: 'aspect-video w-full max-w-48' },
    { label: 'Portrait', className: 'aspect-[3/4] w-full max-w-28' },
    { label: 'Square', className: 'aspect-square w-full max-w-36' },
]

function FocalCropPreview({ imageUrl, point, shape }) {
    const frameRef = useRef(null)
    const [frame, setFrame] = useState({ width: 0, height: 0 })
    const [image, setImage] = useState({ width: 0, height: 0 })

    useEffect(() => {
        const element = frameRef.current
        if (!element) return
        const measure = () => setFrame({ width: element.clientWidth, height: element.clientHeight })
        measure()
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(measure)
            observer.observe(element)
            return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    const cropStyle = getFocalCropStyle(image, frame, point)

    return <div ref={frameRef} className={`relative overflow-hidden bg-gray-100 ${shape.className}`}>
        <img src={imageUrl} alt={`${shape.label} crop preview`} draggable="false"
            onLoad={event => setImage({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            className={cropStyle ? 'absolute max-w-none' : 'h-full w-full object-cover'}
            style={cropStyle || { objectPosition: `${point.x * 100}% ${point.y * 100}%` }} />
    </div>
}

export default function ImageFocalPointDialog({ file, onClose, onSaved }) {
    const initial = file.focalPoint || file.focal_point || CENTER
    const [point, setPoint] = useState(initial)
    const [imageUrl, setImageUrl] = useState(file.imgproxyBaseUrl || file.fileUrl || file.file_url || '')
    const [dragging, setDragging] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        const source = file.imgproxyBaseUrl || file.fileUrl || file.file_url
        if (source) {
            getImgproxyUrl(source, { width: 1200, height: 1200, resize_type: 'fit' })
                .then(url => { if (active && url) setImageUrl(url) })
        }
        return () => { active = false }
    }, [file.imgproxyBaseUrl, file.fileUrl, file.file_url])

    const moveTo = event => {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        setPoint({
            x: Math.round(clamp((event.clientX - bounds.left) / bounds.width) * 1000) / 1000,
            y: Math.round(clamp((event.clientY - bounds.top) / bounds.height) * 1000) / 1000,
        })
    }

    const save = async () => {
        if (saving) return
        setSaving(true)
        setError('')
        try {
            const updated = await mediaApi.files.update(file.id, { focal_point: point })()
            onSaved?.(updated)
            onClose()
        } catch (saveError) {
            setError(extractErrorMessage(saveError))
        } finally {
            setSaving(false)
        }
    }

    return <Dialog open onClose={saving ? () => {} : onClose} className="relative z-[70]">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="flex h-[min(85dvh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-xl">
                <div className="shrink-0 border-b border-gray-200 px-5 py-4">
                    <DialogTitle className="text-lg font-semibold text-gray-900">Choose image focus</DialogTitle>
                    <p className="mt-1 text-sm text-gray-600">Click or drag on the image. Each crop centers the focus where possible and shrinks the image by no more than 2×.</p>
                </div>

                <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                        <div className="flex min-h-64 items-center justify-center rounded border border-gray-200 bg-gray-50 p-3">
                            <div className="relative inline-block max-w-full">
                                <img src={imageUrl} alt={file.title || 'Selected image'} draggable="false"
                                    className="block max-h-[42dvh] max-w-full select-none" />
                                <div className="absolute inset-0 cursor-crosshair touch-none" role="button" tabIndex={0}
                                    aria-label={`Image focus at ${Math.round(point.x * 100)} percent across and ${Math.round(point.y * 100)} percent down. Use the sliders for keyboard adjustment.`}
                                    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); moveTo(event) }}
                                    onPointerMove={event => { if (dragging) moveTo(event) }}
                                    onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
                                    onKeyDown={event => {
                                        const step = event.shiftKey ? 0.1 : 0.01
                                        if (event.key === 'ArrowLeft') setPoint(value => ({ ...value, x: clamp(value.x - step) }))
                                        else if (event.key === 'ArrowRight') setPoint(value => ({ ...value, x: clamp(value.x + step) }))
                                        else if (event.key === 'ArrowUp') setPoint(value => ({ ...value, y: clamp(value.y - step) }))
                                        else if (event.key === 'ArrowDown') setPoint(value => ({ ...value, y: clamp(value.y + step) }))
                                        else return
                                        event.preventDefault()
                                    }}>
                                    <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow-md"
                                        style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {['x', 'y'].map(axis => <label key={axis} className="text-xs font-medium text-gray-700">
                                {axis === 'x' ? 'Horizontal' : 'Vertical'}: {Math.round(point[axis] * 100)}%
                                <input type="range" min="0" max="100" value={Math.round(point[axis] * 100)}
                                    onChange={event => setPoint(value => ({ ...value, [axis]: Number(event.target.value) / 100 }))}
                                    className="mt-2 w-full accent-blue-600" />
                            </label>)}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">Live previews</h3>
                        <div className="mt-3 space-y-4">
                            {previewShapes.map(shape => <div key={shape.label} className="rounded border border-gray-200 p-3">
                                <div className="flex min-h-32 items-center justify-center bg-gray-50">
                                    <FocalCropPreview imageUrl={imageUrl} point={point} shape={shape} />
                                </div>
                                <p className="mt-2 text-xs text-gray-600">{shape.label}</p>
                            </div>)}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
                    <button type="button" onClick={() => setPoint(CENTER)} className="text-sm text-blue-700 hover:underline">Reset to center</button>
                    <div className="flex items-center gap-3">
                        {error && <p role="alert" className="max-w-64 text-xs text-red-700">{error}</p>}
                        <button type="button" onClick={onClose} disabled={saving} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="button" onClick={save} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save focus'}
                        </button>
                    </div>
                </div>
            </DialogPanel>
        </div>
    </Dialog>
}
