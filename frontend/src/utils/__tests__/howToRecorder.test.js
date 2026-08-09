import { describe, expect, it } from 'vitest'
import { convertRecordedEventsToScriptBlocks } from '../howToRecorder'

const target = (overrides = {}) => ({
    selector: overrides.selector || '',
    testId: overrides.testId || '',
    tagName: overrides.tagName || 'button',
    role: overrides.role || '',
    name: overrides.name || '',
    label: overrides.label || '',
    placeholder: overrides.placeholder || '',
    text: overrides.text || '',
    ...overrides
})

describe('howToRecorder', () => {
    it('converts navigation and clicks into editable action blocks', () => {
        expect(convertRecordedEventsToScriptBlocks([
            { kind: 'navigation', url: 'http://localhost:3000/pages', timestamp: 1 },
            { kind: 'click', target: target({ role: 'button', name: 'Save' }), timestamp: 2 }
        ], { baseUrl: 'http://localhost:3000' })).toEqual([
            { caption: '', action: { type: 'goto', path: '/pages', holdMs: 450 } },
            { caption: '', action: { type: 'click', targetMode: 'role', role: 'button', name: 'Save', holdMs: 500 } }
        ])
    })

    it('collapses repeated input events into one fill action', () => {
        expect(convertRecordedEventsToScriptBlocks([
            { kind: 'input', target: target({ tagName: 'input', label: 'Title' }), value: 'D', timestamp: 1 },
            { kind: 'input', target: target({ tagName: 'input', label: 'Title' }), value: 'Demo page', timestamp: 2 }
        ])).toEqual([
            { caption: '', action: { type: 'fill', targetMode: 'label', label: 'Title', value: 'Demo page', holdMs: 500 } }
        ])
    })

    it('converts select changes into select actions', () => {
        expect(convertRecordedEventsToScriptBlocks([
            { kind: 'select', target: target({ tagName: 'select', label: 'Layout' }), value: 'main_layout', timestamp: 1 }
        ])).toEqual([
            { caption: '', action: { type: 'select', targetMode: 'label', label: 'Layout', value: 'main_layout', holdMs: 500 } }
        ])
    })

    it('converts hover-revealed clicks into hoverClick actions', () => {
        expect(convertRecordedEventsToScriptBlocks([
            {
                kind: 'click',
                timestamp: 1000,
                hoverTarget: target({ selector: '[data-testid="widget-row"]', tagName: 'div', timestamp: 200 }),
                target: target({ selector: 'button[aria-label="Edit"]', tagName: 'button', role: 'button', name: 'Edit' })
            }
        ])).toEqual([
            {
                caption: '',
                action: {
                    type: 'hoverClick',
                    targetMode: 'selector',
                    selector: '[data-testid="widget-row"]',
                    clickSelector: 'button[aria-label="Edit"]',
                    hoverHoldMs: 300,
                    holdMs: 500
                }
            }
        ])
    })

    it('attaches recorded audio metadata by action timing', () => {
        const blocks = convertRecordedEventsToScriptBlocks([
            { kind: 'click', target: target({ role: 'button', name: 'Open' }), timestamp: 2000 },
            { kind: 'click', target: target({ role: 'button', name: 'Save' }), timestamp: 5000 }
        ], {
            audio: {
                startedAt: 1000,
                durationMs: 8000,
                fullAudioUrl: '/__howto-script-editor/record/abc/audio/full',
                clipBaseUrl: '/__howto-script-editor/record/abc/audio'
            }
        })

        expect(blocks[0].audio).toMatchObject({
            source: 'recorded',
            url: '/__howto-script-editor/record/abc/audio/block-001.webm',
            fullUrl: '/__howto-script-editor/record/abc/audio/full',
            startMs: 0,
            endMs: 3850,
            trimStartMs: 0,
            trimEndMs: 0
        })
        expect(blocks[1].audio.url).toBe('/__howto-script-editor/record/abc/audio/block-002.webm')
    })
})
