export const NEWS_FLASH_BATCH = 12
export const newsFlashLayout = (config: Record<string, any> = {}) => {
    const count = (camel: string, snake: string, fallback: number) => {
        const raw = config[camel] ?? config[snake] ?? fallback
        const number = Number(raw)
        return Number.isSafeInteger(number) && number >= 0 ? number : fallback
    }
    const full = count('fullWidthCount', 'full_width_count', 1)
    const half = count('halfWidthCount', 'half_width_count', 2)
    const third = count('thirdWidthCount', 'third_width_count', 0)
    return { full, half, third, total: Math.min(Number.MAX_SAFE_INTEGER, full + half + third),
        size: (index: number) => index < full ? 'full' : index < full + half ? 'half' : 'third' }
}
