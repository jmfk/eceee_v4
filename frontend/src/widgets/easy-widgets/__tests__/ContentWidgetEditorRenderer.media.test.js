import { afterEach, expect, it } from 'vitest'
import ContentWidgetEditorRenderer from '../ContentWidgetEditorRenderer'

let renderer
afterEach(() => renderer?.destroy())

it('omits Media Manager controls when media insertion is disabled', async () => {
    const container = document.createElement('div')
    renderer = new ContentWidgetEditorRenderer(container, { fieldMode: true, allowMediaInsert: false })
    renderer.render()

    expect(container.querySelector('[title="Insert Image or Collection"]')).toBeNull()
    expect(renderer.toolbarButtons.has('insertImage')).toBe(false)
    await expect(renderer.openMediaInsertModal()).resolves.toBeUndefined()
})
