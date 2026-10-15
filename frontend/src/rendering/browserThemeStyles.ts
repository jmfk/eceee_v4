import { getBatchImgproxyUrls } from '../utils/imgproxySecure'
import {
    compileRenderStyles,
    type CompileRenderStylesInput,
    type CompiledRenderStyles,
} from './themeCssCompiler'

type JsonObject = Record<string, any>

const object = (value: unknown): JsonObject | null => value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null

const positiveNumber = (value: unknown): number | null => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

const sourceUrl = (image: JsonObject): string => String(
    image.imgproxyBaseUrl ?? image.imgproxy_base_url
    ?? image.fileUrl ?? image.file_url
    ?? image.publicUrl ?? image.public_url
    ?? image.url ?? '',
)

const backgroundImages = (candidate: unknown, images: JsonObject[] = []): JsonObject[] => {
    if (Array.isArray(candidate)) {
        candidate.forEach(item => backgroundImages(item, images))
        return images
    }
    const source = object(candidate)
    if (!source) return images
    Object.entries(source).forEach(([key, value]) => {
        if (key.replace(/_/g, '').toLowerCase() === 'backgroundimage') {
            const image = object(value)
            if (image) images.push(image)
        }
        backgroundImages(value, images)
    })
    return images
}

export const resolveBrowserThemeBackgrounds = async (rawTheme: JsonObject | null | undefined): Promise<JsonObject | null> => {
    if (!rawTheme) return null
    const theme = structuredClone(rawTheme)
    const requests: JsonObject[] = []
    const assignments: Array<(url: string) => void> = []

    backgroundImages(theme).forEach(image => {
        const existingOneX = image.oneX ?? image.one_x
        const existingTwoX = image.twoX ?? image.two_x
        if (existingOneX && existingTwoX) return
        const url = sourceUrl(image)
        const width = positiveNumber(image.width ?? image.originalWidth ?? image.original_width)
        const height = positiveNumber(image.height ?? image.originalHeight ?? image.original_height)
        if (!url || !width || !height) return
        const dpr = positiveNumber(image.dpr) ?? 2
        const oneXWidth = Math.max(1, Math.floor(width / dpr))
        const oneXHeight = Math.max(1, Math.floor(height / dpr))

        image.url = url
        if (!existingOneX) {
            requests.push({ sourceUrl: url, width: oneXWidth, height: oneXHeight, resize_type: 'fit' })
            assignments.push(resolved => { image.oneX = resolved })
        }
        if (!existingTwoX) {
            requests.push({ sourceUrl: url, width, height, resize_type: 'fit' })
            assignments.push(resolved => { image.twoX = resolved })
        }
    })

    if (requests.length) {
        const urls = await getBatchImgproxyUrls(requests)
        urls.forEach((url, index) => assignments[index]?.(url))
    }
    return theme
}

export const compileBrowserRenderStyles = async (
    input: CompileRenderStylesInput,
): Promise<CompiledRenderStyles> => compileRenderStyles({
    ...input,
    theme: await resolveBrowserThemeBackgrounds(input.theme),
    resolveBackgroundImage: undefined,
})
