export function getFocalCropStyle(image, frame, point, minimumScale = 0.5) {
    if (!image.width || !image.height || !frame.width || !frame.height) return null

    // Fill the frame, but never shrink the loaded preview image below half size.
    const scale = Math.max(frame.width / image.width, frame.height / image.height, minimumScale)
    const width = image.width * scale
    const height = image.height * scale
    const left = Math.max(frame.width - width, Math.min(0, frame.width / 2 - point.x * width))
    const top = Math.max(frame.height - height, Math.min(0, frame.height / 2 - point.y * height))

    return { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` }
}
