import { describe, expect, it } from 'vitest'
import {
    createMarkdownFromDraft,
    guideToScriptDraft,
    getPublishedVideoLinks,
    normalizeScriptBlock,
    serializeAction,
    validateScriptDraft
} from '../howToScriptEditor'
import { parseHowToMarkdown } from '../howToMarkdown'

describe('howToScriptEditor', () => {
    it('serializes actions without editor-only fields', () => {
        expect(serializeAction({
            type: 'click',
            targetMode: 'text',
            selector: '#ignored',
            text: 'Save',
            exact: false,
            caption: 'Save the draft.',
            holdMs: '800'
        })).toEqual({
            type: 'click',
            text: 'Save',
            holdMs: 800
        })
    })

    it('preserves advanced generator action fields', () => {
        expect(serializeAction({
            type: 'click',
            pageTreeAddChildForText: 'Venue & travel',
            caption: 'Add a child page.',
            holdMs: '500'
        })).toEqual({
            type: 'click',
            pageTreeAddChildForText: 'Venue & travel',
            holdMs: 500
        })
    })

    it('serializes cut-from-video waits', () => {
        expect(serializeAction({
            type: 'waitForText',
            text: 'Loaded',
            cutFromVideo: true
        })).toEqual({
            type: 'waitForText',
            text: 'Loaded',
            cutFromVideo: true
        })
    })

    it('generates markdown that the help parser can read', () => {
        const draft = guideToScriptDraft({
            id: 'pages-demo',
            title: 'Create demo content',
            summary: 'Create one safe demo page.',
            order: 4,
            script: [
                { caption: 'Open Pages.', action: { type: 'goto', path: '/pages' } },
                { caption: 'Use a clear title.', action: { type: 'fill', selector: '#title', value: 'Demo page' } },
                { caption: 'This part is voiceover only.', action: null }
            ]
        }, {
            id: 'pages',
            title: 'Pages',
            summary: 'Page work.',
            order: 1
        })

        const markdown = createMarkdownFromDraft(draft)
        const parsed = parseHowToMarkdown(markdown)

        expect(parsed.type).toBe('guide')
        expect(parsed.guide).toMatchObject({
            id: 'pages-demo',
            title: 'Create demo content',
            summary: 'Create one safe demo page.',
            steps: ['Open Pages.', 'Use a clear title.', 'This part is voiceover only.']
        })
        expect(parsed.guide.actions).toEqual([
            { type: 'goto', path: '/pages', caption: 'Open Pages.' },
            { type: 'fill', selector: '#title', value: 'Demo page', caption: 'Use a clear title.' },
            { type: 'caption', caption: 'This part is voiceover only.' }
        ])
    })

    it('preserves selected languages and language-specific video links', () => {
        const draft = guideToScriptDraft({
            id: 'pages-demo',
            title: 'Create demo content',
            summary: 'Create one safe demo page.',
            videoSources: [
                {
                    language: 'sv',
                    videoUrl: '/howto-videos/prod/sv/pages-pages-demo.mp4',
                    captionsUrl: '/howto-videos/prod/sv/pages-pages-demo.vtt'
                },
                {
                    language: 'en',
                    videoUrl: '/howto-videos/prod/en/pages-pages-demo.mp4',
                    captionsUrl: '/howto-videos/prod/en/pages-pages-demo.vtt'
                }
            ],
            script: [{ caption: 'Open Pages.', action: { type: 'goto', path: '/pages' } }]
        }, { id: 'pages', title: 'Pages' })

        expect(draft.videoLanguages).toEqual(['sv', 'en'])
        expect(draft.videoLinks).toMatchObject({
            sv: {
                videoUrl: '/howto-videos/prod/sv/pages-pages-demo.mp4',
                captionsUrl: '/howto-videos/prod/sv/pages-pages-demo.vtt'
            },
            en: {
                videoUrl: '/howto-videos/prod/en/pages-pages-demo.mp4',
                captionsUrl: '/howto-videos/prod/en/pages-pages-demo.vtt'
            }
        })

        const parsed = parseHowToMarkdown(createMarkdownFromDraft(draft))

        expect(parsed.guide.videoLanguages).toEqual(['sv', 'en'])
        expect(parsed.guide.videoSources).toEqual([
            {
                language: 'sv',
                videoUrl: '/howto-videos/prod/sv/pages-pages-demo.mp4',
                mp4Url: '/howto-videos/prod/sv/pages-pages-demo.mp4',
                captionsUrl: '/howto-videos/prod/sv/pages-pages-demo.vtt',
                subtitlesUrl: '/howto-videos/prod/sv/pages-pages-demo.vtt'
            },
            {
                language: 'en',
                videoUrl: '/howto-videos/prod/en/pages-pages-demo.mp4',
                mp4Url: '/howto-videos/prod/en/pages-pages-demo.mp4',
                captionsUrl: '/howto-videos/prod/en/pages-pages-demo.vtt',
                subtitlesUrl: '/howto-videos/prod/en/pages-pages-demo.vtt'
            }
        ])
    })

    it('builds public video links for publishing reviewed editor previews', () => {
        expect(getPublishedVideoLinks({
            id: 'pages demo!',
            sectionId: 'pages',
            videoLanguages: ['sv', 'en']
        })).toEqual({
            sv: {
                videoUrl: '/howto-videos/prod/sv/pages-pages-demo.mp4',
                captionsUrl: '/howto-videos/prod/sv/pages-pages-demo.vtt'
            },
            en: {
                videoUrl: '/howto-videos/prod/en/pages-pages-demo.mp4',
                captionsUrl: '/howto-videos/prod/en/pages-pages-demo.vtt'
            }
        })
    })

    it('reports missing targets while allowing action-only blocks', () => {
        const issues = validateScriptDraft({
            id: 'demo',
            title: 'Demo',
            summary: 'Demo summary',
            script: [
                { caption: '', action: { type: 'click', targetMode: 'selector', selector: '' } },
                { caption: 'Voiceover only.', action: null }
            ]
        })

        expect(issues.map(issue => issue.message)).toContain('Block 1: target is missing.')
        expect(issues.map(issue => issue.message)).not.toContain('Block 1: caption is missing.')
    })

    it('normalizes non-string caption values without crashing previews', () => {
        expect(normalizeScriptBlock({
            caption: { text: 'Open Pages.' },
            action: { type: 'goto', path: '/pages' }
        })).toMatchObject({
            caption: 'Open Pages.',
            action: { type: 'goto', path: '/pages' }
        })
    })

    it('preserves in-progress caption whitespace while editing', () => {
        expect(normalizeScriptBlock({
            caption: 'Open the page ',
            action: null
        })).toMatchObject({
            caption: 'Open the page ',
            action: null
        })
    })
})
