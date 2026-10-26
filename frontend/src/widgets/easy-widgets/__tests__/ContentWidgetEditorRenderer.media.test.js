import { afterEach, expect, it, vi } from 'vitest'
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

it('uses the direct upload callback for the image toolbar button', () => {
    const container = document.createElement('div')
    const onImageUpload = vi.fn()
    renderer = new ContentWidgetEditorRenderer(container, { fieldMode: true, allowMediaInsert: false, onImageUpload })
    renderer.render()

    container.querySelector('[title="Ladda upp bild"]').click()
    expect(onImageUpload).toHaveBeenCalledOnce()
})
