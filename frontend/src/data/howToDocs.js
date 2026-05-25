import { parseHowToMarkdownCollection } from '../utils/howToMarkdown'

const markdownModules = import.meta.glob('../docs/how-to/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
})

const translationModules = import.meta.glob('../docs/how-to-translations/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
})

const baseDocs = parseHowToMarkdownCollection(markdownModules)
const translationDocs = parseHowToMarkdownCollection(translationModules)

const translationsByGuideId = new Map()

translationDocs.forEach(section => {
    section.guides.forEach(guide => {
        const language = guide.language || 'sv'
        const current = translationsByGuideId.get(guide.id) || {}
        translationsByGuideId.set(guide.id, {
            ...current,
            [language]: {
                ...guide,
                section: {
                    id: section.id,
                    title: section.title,
                    summary: section.summary,
                    order: section.order
                }
            }
        })
    })
})

export const howToDocs = baseDocs.map(section => ({
    ...section,
    guides: section.guides.map(guide => ({
        ...guide,
        translations: translationsByGuideId.get(guide.id) || {}
    }))
}))

export const getHowToDocById = (id) => howToDocs.find(doc => doc.id === id)
