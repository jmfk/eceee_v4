import React, { createRef } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import IsolatedFormRenderer from '../IsolatedFormRenderer'
import RichTextInput from '../form-fields/RichTextInput'

const subscriptions = []
vi.mock('../fields/HtmlEditor', () => ({
  HtmlEditor: ({ value, onChange }) => <textarea aria-label="HTML source" value={value} onChange={event => onChange(event.target.value)} />
}))
vi.mock('../../api/widgetSchemas', () => ({
  getWidgetSchema: vi.fn(), validateWidgetConfiguration: vi.fn(async () => ({ errors: {}, warnings: {} }))
}))
vi.mock('../../contexts/unified-data/context/UnifiedDataContext', () => ({
  useUnifiedData: () => ({
    useExternalChanges: (id, callback) => { subscriptions.push({ id, callback }) },
    publishUpdate: vi.fn(), getState: () => ({})
  })
}))
const initial = { id: 'one', type: 'test', slotName: 'main', config: { title: 'Old', other: 'Sibling' } }
const schema = { properties: {
  title: { type: 'string', component: 'TextInput', title: 'Title', group: 'Content' },
  other: { type: 'string', component: 'TextInput', title: 'Other', group: 'Content' }
} }
const context = { pageId: '101', versionId: '201', contextType: 'page' }
const ready = async name => {
  let field
  await waitFor(() => {
    field = screen.getByRole('textbox', { name, exact: true })
    expect(field.readOnly).not.toBe(true)
  })
  return field
}
beforeEach(() => {
  subscriptions.length = 0
  document.queryCommandState = vi.fn(() => false)
  document.queryCommandValue = vi.fn(() => '')
})

it('resets schema, data and fields on version changes with the same widget ID', async () => {
  const ref = createRef()
  const props = { ref, initWidgetData: initial, initschema: schema, context, publishChanges: false }
  const { rerender } = render(<IsolatedFormRenderer {...props} />)
  fireEvent.change(await ready('Title'), { target: { value: 'Local' } })
  const next = { ...initial, config: { replacement: 'New version' } }
  rerender(<IsolatedFormRenderer {...props} initWidgetData={next} context={{ ...context, versionId: '202' }}
    initschema={{ properties: { replacement: { type: 'string', component: 'TextInput', title: 'Replacement' } } }} />)
  expect(await ready('Replacement')).toHaveValue('New version')
  expect(screen.queryByRole('textbox', { name: 'Title', exact: true })).toBeNull()
  expect(ref.current.getCurrentWidgetData()).toEqual(next)
})

it('hydrates external fields silently and ignores older echoes of its own edits', async () => {
  const ref = createRef()
  const onWidgetChange = vi.fn()
  render(<IsolatedFormRenderer ref={ref} initWidgetData={initial} initschema={schema}
    context={context} publishChanges={false} onWidgetChange={onWidgetChange} />)
  const title = await ready('Title')
  fireEvent.change(title, { target: { value: 'First local' } })
  fireEvent.change(title, { target: { value: 'Latest local' } })
  const callback = subscriptions.at(-1).callback
  const state = config => ({ versions: { 201: { widgets: { main: [{ ...initial, config }] } } }, metadata: { currentVersionId: '201' } })
  act(() => callback(state({ title: 'First local', other: 'Sibling' }), { sourceId: 'isolated-form-one-field-title' }))
  expect(title).toHaveValue('Latest local')
  expect(ref.current.getCurrentWidgetData().config.title).toBe('Latest local')
  const count = onWidgetChange.mock.calls.length
  act(() => callback(state({ title: 'Latest local', other: 'External sibling' }), { sourceId: 'external-editor' }))
  expect(await ready('Other')).toHaveValue('External sibling')
  expect(onWidgetChange).toHaveBeenCalledTimes(count)
  act(() => callback(state({ title: 'Inline widget update', other: 'External sibling' }), {
    sourceId: 'bannerwidget-one-field-title'
  }))
  expect(title).toHaveValue('Inline widget update')
  expect(onWidgetChange).toHaveBeenCalledTimes(count)
  fireEvent.change(title, { target: { value: 'Final local' } })
  expect(ref.current.getCurrentWidgetData().config).toEqual({ title: 'Final local', other: 'External sibling' })
})

it('preserves richtext DOM, selection and untouched HTML through echoes; hydration is silent', () => {
  const onChange = vi.fn()
  const html = '<p data-note="keep">Existing <a href="/link">link</a></p>'
  const { rerender } = render(<RichTextInput label="Body" value={html} onChange={onChange} />)
  const editor = screen.getByRole('textbox', { name: 'Body' })
  expect(onChange).not.toHaveBeenCalled()
  expect(editor.innerHTML).toBe(html)
  editor.innerHTML = '<p>New body</p>'
  fireEvent.input(editor)
  expect(onChange).toHaveBeenCalledExactlyOnceWith('<p>New body</p>')
  const range = document.createRange()
  range.setStart(editor.firstChild.firstChild, 1)
  range.setEnd(editor.firstChild.firstChild, 4)
  window.getSelection().removeAllRanges()
  window.getSelection().addRange(range)
  rerender(<RichTextInput label="Body" value="<p>New body</p>" onChange={onChange} />)
  expect(screen.getByRole('textbox', { name: 'Body' })).toBe(editor)
  expect(window.getSelection().toString()).toBe('ew ')
  rerender(<RichTextInput label="Body" value="<p>External</p>" onChange={onChange} disabled />)
  expect(editor).toHaveTextContent('External')
  expect(editor).toHaveAttribute('contenteditable', 'false')
  expect(onChange).toHaveBeenCalledTimes(1)
})

it('writes nested richtext immediately through the parent list buffer', async () => {
  const ref = createRef()
  const onWidgetChange = vi.fn()
  const item = { _itemId: 'stable-item', body: '<p>Old item</p>' }
  render(<IsolatedFormRenderer ref={ref} initWidgetData={{ ...initial, config: { items: [item] } }}
    initschema={{ properties: { items: { type: 'array', component: 'ItemsListField', title: 'Items', group: 'Content',
      items: { type: 'object', properties: { body: { type: 'string', component: 'RichTextInput', title: 'Item body' } } } } } }}
    context={context} publishChanges={false} onWidgetChange={onWidgetChange} />)
  await screen.findByRole('button', { name: 'Item 1', exact: true })
  fireEvent.click(screen.getByRole('button', { name: 'Item 1', exact: true }))
  const rich = await ready('Item body')
  rich.innerHTML = '<p>Last item keystroke</p>'
  fireEvent.input(rich)
  expect(ref.current.getCurrentWidgetData().config.items[0].body).toBe('<p>Last item keystroke</p>')
  expect(onWidgetChange).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('textbox', { name: 'Item body' })).toBe(rich)
})

it('keeps trusted scripts and embeds in a lossless source-only view', async () => {
  const { default: HtmlSourceField } = await import('../fields/HtmlSourceField')
  const onChange = vi.fn()
  const raw = '<p>Trusted HTML</p><script>window.customWidget = true</script><iframe src="https://example.test/embed"></iframe>'
  const { rerender } = render(<HtmlSourceField value={raw} onChange={onChange} label="Custom HTML" />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'Open HTML Editor' })).toBeEnabled()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open HTML Editor' }))
  expect(screen.getByRole('textbox', { name: 'HTML source' })).toHaveValue(raw)
  rerender(<HtmlSourceField value={raw} onChange={onChange} label="Custom HTML" disabled />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
})

it('preserves unsupported HTML in ordinary richtext fields through source editing and external hydration', () => {
  const raw = '<p>Existing copy</p><iframe src="https://example.test/embed"></iframe>'
  const onChange = vi.fn()
  const { rerender } = render(<RichTextInput value={raw} onChange={onChange} label="Body" />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open HTML Editor' }))
  const source = screen.getByRole('textbox', { name: 'HTML source' })
  expect(source).toHaveValue(raw)
  const updated = raw.replace('Existing copy', 'Edited copy')
  fireEvent.change(source, { target: { value: updated } })
  expect(onChange).toHaveBeenLastCalledWith(updated)
  rerender(<RichTextInput value={updated} onChange={onChange} label="Body" disabled />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'Open HTML Editor' })).toBeDisabled()
  rerender(<RichTextInput value="<p>Supported HTML</p>" onChange={onChange} label="Body" />)
  expect(screen.getByRole('textbox', { name: 'Body' })).toHaveTextContent('Supported HTML')
  expect(onChange).toHaveBeenCalledTimes(1)
})

it.each([
  ['images', '<img src="/header.png" alt="Logo">Header'],
  ['inline attributes', '<span class="highlight" style="color:red" data-note="keep">Header</span>'],
  ['blocks', '<p>Existing header</p>']
])('preserves existing %s that inline formatting cannot round-trip', (_, raw) => {
  const onChange = vi.fn()
  render(<RichTextInput value={raw} onChange={onChange} label="Headline" inlineOnly />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open HTML Editor' }))
  const source = screen.getByRole('textbox', { name: 'HTML source' })
  expect(source).toHaveValue(raw)
  const updated = raw.replace(/Header|header/, 'Edited')
  fireEvent.change(source, { target: { value: updated } })
  expect(onChange).toHaveBeenLastCalledWith(updated)
})

it.each(['paste', 'plainPaste', 'formatBlock'])('preserves unrelated body markup during %s and updates the save buffer synchronously', async action => {
  const ref = createRef()
  const untouched = '<span class="highlight" style="color:red" data-note="keep">Existing</span>'
  render(<IsolatedFormRenderer ref={ref} initWidgetData={{ ...initial, config: { body: `<p>${untouched}</p><p>Target</p>` } }}
    initschema={{ properties: { body: { type: 'string', component: 'RichTextInput', title: 'Body', group: 'Content' } } }}
    context={context} publishChanges={false} />)
  const editor = await ready('Body')
  const target = editor.lastChild
  const range = document.createRange()
  range.selectNodeContents(target)
  range.collapse(false)
  window.getSelection().removeAllRanges()
  window.getSelection().addRange(range)
  document.execCommand = vi.fn((command, _, value) => {
    if (command === 'insertHTML') range.insertNode(range.createContextualFragment(value))
    if (command === 'formatBlock') {
      const heading = document.createElement('h2')
      heading.append(...target.childNodes)
      target.replaceWith(heading)
    }
    return true
  })
  if (action !== 'formatBlock') {
    const plain = action === 'plainPaste'
    fireEvent.paste(editor, { clipboardData: { getData: type => plain
      ? (type === 'text/plain' ? '<b>Literal</b>' : '') : '<p>Pasted</p>' } })
    expect(ref.current.getCurrentWidgetData().config.body).toContain(plain ? '&lt;b&gt;Literal&lt;/b&gt;' : 'Pasted')
    if (plain) expect(editor.querySelector('b')).toBeNull()
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Format', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Heading 2', exact: true }))
    expect(ref.current.getCurrentWidgetData().config.body).toContain('<h2>Target</h2>')
  }
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(editor.querySelector('.highlight')?.outerHTML).toBe(untouched)
  expect(ref.current.getCurrentWidgetData().config.body).toContain(untouched)
})

it.each(['mouse', 'keyboard'])('keeps toolbar commands in their own field with %s activation', activation => {
  render(<><RichTextInput label="First" value="<p>First</p>" onChange={vi.fn()} />
    <RichTextInput label="Second" value="<p>Second</p>" onChange={vi.fn()} /></>)
  const first = screen.getByRole('textbox', { name: 'First' })
  const second = screen.getByRole('textbox', { name: 'Second' })
  const range = document.createRange()
  range.selectNodeContents(first)
  window.getSelection().removeAllRanges()
  window.getSelection().addRange(range)
  let commandInsideSecond = false
  document.execCommand = vi.fn(() => { commandInsideSecond = second.contains(window.getSelection().anchorNode); return true })
  const button = screen.getByRole('toolbar', { name: 'Second formatting' }).querySelector('[title="Bold"]')
  if (activation === 'mouse') fireEvent.mouseDown(button)
  else act(() => button.focus())
  fireEvent.click(button)
  expect(document.execCommand).toHaveBeenCalledWith('bold', false, null)
  expect(commandInsideSecond).toBe(true)
  expect(second).toHaveFocus()
  expect(first.innerHTML).toBe('<p>First</p>')
})

it('restricts inline paste and shortcuts and blocks edit events after disabling', () => {
  const onChange = vi.fn()
  document.execCommand = vi.fn((command, _, value) => {
    if (command === 'insertHTML') screen.getByRole('textbox', { name: 'Inline' }).innerHTML += value
  })
  const { rerender } = render(<RichTextInput label="Inline" inlineOnly value="Original" onChange={onChange} />)
  const editor = screen.getByRole('textbox', { name: 'Inline' })
  fireEvent.paste(editor, { clipboardData: { getData: type => type === 'text/html' ? '<h2>Heading</h2><ul><li>Item</li></ul>' : 'Heading Item' } })
  expect(document.execCommand).toHaveBeenCalledWith('insertHTML', false, 'Heading<br>Item')
  expect(onChange).toHaveBeenLastCalledWith('OriginalHeading<br>Item')
  document.execCommand.mockClear()
  fireEvent.keyDown(editor, { key: '2', metaKey: true })
  expect(document.execCommand).not.toHaveBeenCalled()
  rerender(<RichTextInput label="Inline" inlineOnly value="Original" onChange={onChange} disabled />)
  onChange.mockClear()
  fireEvent.paste(editor, { clipboardData: { getData: () => '<p>Blocked</p>' } })
  fireEvent.keyDown(editor, { key: 'Enter' })
  fireEvent.input(editor)
  expect(document.execCommand).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})

it.each([false, true])('allows native Tab navigation in richtext fields (inlineOnly=%s)', inlineOnly => {
  render(<RichTextInput label="Keyboard field" value="Text" onChange={vi.fn()} inlineOnly={inlineOnly} />)
  const editor = screen.getByRole('textbox', { name: 'Keyboard field' })
  document.execCommand = vi.fn()
  expect(fireEvent.keyDown(editor, { key: 'Tab' })).toBe(true)
  expect(fireEvent.keyDown(editor, { key: 'Tab', shiftKey: true })).toBe(true)
  expect(document.execCommand).not.toHaveBeenCalled()
})

it('keeps the native context menu for inline fields instead of showing unavailable block commands', () => {
  render(<RichTextInput label="Headline" value="Text" onChange={vi.fn()} inlineOnly />)
  const editor = screen.getByRole('textbox', { name: 'Headline' })
  const parentMenu = vi.fn()
  document.addEventListener('contextmenu', parentMenu)
  try {
    expect(fireEvent.contextMenu(editor)).toBe(true)
    expect(document.querySelector('.wysiwyg-context-menu-item')).toBeNull()
    expect(parentMenu).not.toHaveBeenCalled()
  } finally {
    document.removeEventListener('contextmenu', parentMenu)
  }
})
