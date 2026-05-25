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

const guideIdentity = (guide = {}) => guide.uuid || guide.guideUuid || guide.id
const translationsByGuideIdentity = new Map()

translationDocs.forEach(section => {
    section.guides.forEach(guide => {
        const language = guide.language || 'sv'
        const identity = guideIdentity(guide)
        const current = translationsByGuideIdentity.get(identity) || {}
        translationsByGuideIdentity.set(identity, {
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
        translations: translationsByGuideIdentity.get(guideIdentity(guide)) || {}
    }))
}))

export const getHowToDocById = (id) => howToDocs.find(doc => doc.id === id)
