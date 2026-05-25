import { describe, expect, it } from 'vitest'
import { parseHowToMarkdown, parseHowToMarkdownCollection } from '../howToMarkdown'

describe('parseHowToMarkdown', () => {
    it('extracts metadata, guides, captions, steps, and video actions', () => {
        const doc = parseHowToMarkdown(`---
id: demo
title: Demo
summary: Demo summary.
order: 2
---

# Demo

Demo summary.

## First Guide

<!-- id: demo-first -->
<!-- videoUrl: /howto-videos/prod/sv/demo-demo-first.mp4 -->
<!-- captionsUrl: /howto-videos/prod/sv/demo-demo-first.vtt -->
<!-- goal: Show the first guide goal. -->
<!-- why: Explain why the first guide matters. -->
<!-- outcome: Know what to do next. -->
<!-- narration: Explain the first guide. -->

This guide does the first thing.

1. Open the page.
2. Confirm the result.

\`\`\`video
[
  { "type": "goto", "path": "/demo", "caption": "Open demo." }
]
\`\`\`
`)

        expect(doc.id).toBe('demo')
        expect(doc.order).toBe(2)
        expect(doc.guides[0]).toMatchObject({
            id: 'demo-first',
            title: 'First Guide',
            summary: 'This guide does the first thing.',
            videoUrl: '/howto-videos/prod/sv/demo-demo-first.mp4',
            captionsUrl: '/howto-videos/prod/sv/demo-demo-first.vtt',
            goal: 'Show the first guide goal.',
            why: 'Explain why the first guide matters.',
            outcome: 'Know what to do next.',
            narration: 'Explain the first guide.',
            steps: ['Open the page.', 'Confirm the result.']
        })
        expect(doc.guides[0].actions).toEqual([
            { type: 'goto', path: '/demo', caption: 'Open demo.' }
        ])
    })

    it('groups single-aspect guide files into sections', () => {
        const docs = parseHowToMarkdownCollection({
            '../docs/how-to/pages/create-page.md': `---
id: pages-create
title: Create a page
summary: Create one page.
order: 1
sectionId: pages
sectionTitle: Pages
sectionSummary: Page work.
sectionOrder: 1
---

# Create a page

Create one page.

1. Open Pages.
`,
            '../docs/how-to/pages/organize-page-tree.md': `---
id: pages-organize
title: Organize the page tree
summary: Move pages.
order: 2
sectionId: pages
sectionTitle: Pages
sectionSummary: Page work.
sectionOrder: 1
---

# Organize the page tree

Move pages.

1. Select a page.
`
        })

        expect(docs).toHaveLength(1)
        expect(docs[0]).toMatchObject({
            id: 'pages',
            title: 'Pages',
            summary: 'Page work.'
        })
        expect(docs[0].guides.map(guide => guide.id)).toEqual(['pages-create', 'pages-organize'])
    })
})
