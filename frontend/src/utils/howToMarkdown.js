export const slugify = (value = '') => value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const parseFrontmatter = (source) => {
    if (!source.startsWith('---')) return [{}, source]

    const endIndex = source.indexOf('\n---', 3)
    if (endIndex === -1) return [{}, source]

    const block = source.slice(3, endIndex).trim()
    const body = source.slice(endIndex + 4).trim()
    const data = {}

    block.split('\n').forEach(line => {
        const separatorIndex = line.indexOf(':')
        if (separatorIndex === -1) return

        const key = line.slice(0, separatorIndex).trim()
        const value = line.slice(separatorIndex + 1).trim()
        data[key] = value.replace(/^['"]|['"]$/g, '')
    })

    return [data, body]
}

const extractCommentValue = (body, key) => {
    const match = body.match(new RegExp(`<!--\\s*${key}\\s*:\\s*([\\s\\S]*?)\\s*-->`, 'i'))
    return match ? match[1].trim() : ''
}

const extractVideoActions = (body) => {
    const match = body.match(/```(?:video|video-actions)\s*([\s\S]*?)```/i)
    if (!match) return []

    try {
        const parsed = JSON.parse(match[1].trim())
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

const stripGuideMarkup = (body) => body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```(?:video|video-actions)\s*[\s\S]*?```/gi, '')
    .trim()

const parseSteps = (body) => {
    const lines = stripGuideMarkup(body).split('\n')

    return lines
        .map(line => line.match(/^\s*\d+\.\s+(.+?)\s*$/))
        .filter(Boolean)
        .map(match => match[1])
}

const parseGuideSummary = (body) => {
    const lines = stripGuideMarkup(body).split('\n')

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || /^\d+\.\s+/.test(trimmed)) continue
        return trimmed
    }

    return ''
}

export const parseHowToMarkdown = (source, fallbackId = '') => {
    const [frontmatter, body] = parseFrontmatter(source)
    const lines = body.split('\n')
    const h1Index = lines.findIndex(line => line.startsWith('# '))
    const title = frontmatter.title || (h1Index >= 0 ? lines[h1Index].replace(/^#\s+/, '').trim() : fallbackId)
    const id = frontmatter.id || slugify(title || fallbackId)
    const summary = frontmatter.summary || lines
        .slice(h1Index + 1)
        .map(line => line.trim())
        .find(line => line && !line.startsWith('#')) || ''

    if (frontmatter.sectionId) {
        return {
            type: 'guide',
            sectionId: frontmatter.sectionId,
            sectionTitle: frontmatter.sectionTitle || frontmatter.sectionId,
            sectionSummary: frontmatter.sectionSummary || '',
            sectionOrder: Number(frontmatter.sectionOrder || 999),
            guide: {
                id,
                title,
                summary,
                order: Number(frontmatter.order || 999),
                videoUrl: frontmatter.videoUrl || '',
                mp4Url: frontmatter.mp4Url || '',
                captionsUrl: frontmatter.captionsUrl || '',
                subtitlesUrl: frontmatter.subtitlesUrl || '',
                videoLanguage: frontmatter.videoLanguage || '',
                youtubeId: frontmatter.youtubeId || '',
                youtubeUrl: frontmatter.youtubeUrl || '',
                narration: frontmatter.narration || extractCommentValue(body, 'narration'),
                steps: parseSteps(body),
                actions: extractVideoActions(body),
                markdown: stripGuideMarkup(body)
            }
        }
    }

    const guideBlocks = []
    let currentGuide = null

    lines.forEach(line => {
        if (line.startsWith('## ')) {
            if (currentGuide) guideBlocks.push(currentGuide)
            currentGuide = {
                title: line.replace(/^##\s+/, '').trim(),
                lines: []
            }
            return
        }

        if (currentGuide) {
            currentGuide.lines.push(line)
        }
    })

    if (currentGuide) guideBlocks.push(currentGuide)

    const guides = guideBlocks.map(guide => {
        const guideBody = guide.lines.join('\n').trim()
        const guideId = extractCommentValue(guideBody, 'id') || `${id}-${slugify(guide.title)}`
        const youtubeId = extractCommentValue(guideBody, 'youtubeId')
        const youtubeUrl = extractCommentValue(guideBody, 'youtubeUrl')
        const videoUrl = extractCommentValue(guideBody, 'videoUrl')
        const mp4Url = extractCommentValue(guideBody, 'mp4Url')
        const captionsUrl = extractCommentValue(guideBody, 'captionsUrl')
        const subtitlesUrl = extractCommentValue(guideBody, 'subtitlesUrl')
        const videoLanguage = extractCommentValue(guideBody, 'videoLanguage')
        const narration = extractCommentValue(guideBody, 'narration')

        return {
            id: guideId,
            title: guide.title,
            summary: parseGuideSummary(guideBody),
            videoUrl,
            mp4Url,
            captionsUrl,
            subtitlesUrl,
            videoLanguage,
            youtubeId,
            youtubeUrl,
            narration,
            steps: parseSteps(guideBody),
            actions: extractVideoActions(guideBody),
            markdown: stripGuideMarkup(guideBody)
        }
    })

    return {
        type: 'section',
        id,
        title,
        summary,
        order: Number(frontmatter.order || 999),
        guides,
        markdown: body
    }
}

export const parseHowToMarkdownCollection = (modules) => {
    const sections = new Map()

    Object.entries(modules).forEach(([path, source]) => {
        const parsed = parseHowToMarkdown(source, path.split('/').pop()?.replace(/\.md$/, ''))

        if (parsed.type === 'guide') {
            parsed.guide.sourcePath = path

            if (!sections.has(parsed.sectionId)) {
                sections.set(parsed.sectionId, {
                    type: 'section',
                    id: parsed.sectionId,
                    title: parsed.sectionTitle,
                    summary: parsed.sectionSummary,
                    order: parsed.sectionOrder,
                    guides: [],
                    markdown: ''
                })
            }

            const section = sections.get(parsed.sectionId)
            section.title = section.title || parsed.sectionTitle
            section.summary = section.summary || parsed.sectionSummary
            section.order = Math.min(section.order, parsed.sectionOrder)
            section.guides.push(parsed.guide)
            return
        }

        const sectionWithSourcePaths = {
            ...parsed,
            guides: parsed.guides.map(guide => ({ ...guide, sourcePath: path }))
        }

        if (!sections.has(parsed.id)) {
            sections.set(parsed.id, sectionWithSourcePaths)
            return
        }

        const section = sections.get(parsed.id)
        section.guides.push(...parsed.guides.map(guide => ({ ...guide, sourcePath: path })))
    })

    return [...sections.values()]
        .map(section => ({
            ...section,
            guides: [...section.guides].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
        }))
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}
