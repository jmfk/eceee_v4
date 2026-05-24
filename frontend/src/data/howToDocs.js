import { parseHowToMarkdownCollection } from '../utils/howToMarkdown'

const markdownModules = import.meta.glob('../docs/how-to/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
})

export const howToDocs = parseHowToMarkdownCollection(markdownModules)

export const getHowToDocById = (id) => howToDocs.find(doc => doc.id === id)
