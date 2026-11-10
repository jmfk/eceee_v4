import { describe, expect, it, vi } from 'vitest'
import ContentWidgetEditorRenderer from '../ContentWidgetEditorRenderer'

const serializeListEdit = editor => {
    const onChange = vi.fn()
    const renderer = new ContentWidgetEditorRenderer(document.createElement('div'), { onChange })
    renderer.editorElement = editor
    renderer.normalizeUnlistedContent = true
    renderer.updateButtonStates = vi.fn()
    renderer.handleContentChange()
    return onChange.mock.calls[0][0]
}

describe('canonical list edit HTML', () => {
    it('promotes malformed nested items in order without changing the live editor', () => {
        const editor = document.createElement('div')
        editor.innerHTML = '<ul><li>Parent</li><li>Other</li></ul>'
        const parent = editor.querySelector('li')
        const first = document.createElement('li')
        first.innerHTML = 'First<li>Grandchild</li>'
        const second = document.createElement('li')
        second.textContent = 'Second'
        parent.append(first, second)
        const original = editor.innerHTML
        const saved = document.createElement('div')
        saved.innerHTML = serializeListEdit(editor)
        expect(Array.from(saved.querySelectorAll(':scope > ul > li'), li => li.textContent))
            .toEqual(['Parent', 'First', 'Grandchild', 'Second', 'Other'])
        expect(saved.querySelector('li > li')).toBeNull()
        expect(editor.innerHTML).toBe(original)
    })

    it('preserves empty lines and inline formatting while producing paragraphs', () => {
        const editor = document.createElement('div')
        editor.innerHTML = '<strong>Alpha</strong><br><br><em>Beta</em>'
        expect(serializeListEdit(editor)).toBe('<p><strong>Alpha</strong></p><p><br></p><p><em>Beta</em></p>')
    })
})
