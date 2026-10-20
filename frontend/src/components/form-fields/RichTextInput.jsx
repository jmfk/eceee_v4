import React, { useEffect, useLayoutEffect, useRef, useId, useMemo, useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import ContentWidgetEditorRenderer from '../../widgets/easy-widgets/ContentWidgetEditorRenderer'
import FieldHelpText from './FieldHelpText'
import { HtmlEditor } from '../fields/HtmlEditor'
import { requiresHtmlSource } from '../../utils/richTextFieldHtml'

/** Own the editor DOM once; local value echoes never reset its content or native undo history. */
const RichTextEditor = ({ value, defaultValue = '', onChange, onBlur, onFocus, label, description,
    required, disabled = false, validation, rows = 6, placeholder, inlineOnly = false,
    namespace, context, fieldName }) => {
    const id = useId()
    const containerRef = useRef(null)
    const editorRef = useRef(null)
    const callbacksRef = useRef({ onChange, onBlur, onFocus })
    callbacksRef.current = { onChange, onBlur, onFocus }
    const lastValueRef = useRef(value ?? defaultValue)

    useLayoutEffect(() => {
        const renderer = new ContentWidgetEditorRenderer(containerRef.current, {
            content: DOMPurify.sanitize(lastValueRef.current || ''), fieldMode: true, inlineOnly,
            namespace, pageId: context?.pageId,
            siteRootId: context?.siteRootId || context?.webpageData?.cachedRootId,
            onChange: html => {
                if (renderer.isDestroyed || renderer.disabled) return
                lastValueRef.current = html
                callbacksRef.current.onChange?.(html)
            }
        })
        renderer.render()
        editorRef.current = renderer
        const element = renderer.editorElement
        element.id = id
        element.setAttribute('role', 'textbox')
        element.setAttribute('aria-multiline', 'true')
        element.setAttribute('aria-label', label || fieldName || 'Rich text')
        element.dataset.placeholder = placeholder || ''
        renderer.toolbarElement?.setAttribute('role', 'toolbar')
        renderer.toolbarElement?.setAttribute('aria-label', `${label || 'Rich text'} formatting`)
        renderer.toolbarElement?.classList.add('flex-wrap')
        const keepSelection = event => {
            if (!event.target.closest('button')) return
            const selection = window.getSelection()
            if (!selection?.rangeCount || !element.contains(selection.getRangeAt(0).commonAncestorContainer)) {
                element.focus()
                if (selection && (!selection.rangeCount || !element.contains(selection.getRangeAt(0).commonAncestorContainer))) {
                    const range = document.createRange()
                    range.selectNodeContents(element)
                    range.collapse(false)
                    selection.removeAllRanges()
                    selection.addRange(range)
                }
            }
            event.preventDefault()
        }
        renderer.toolbarElement?.addEventListener('mousedown', keepSelection)
        // Keyboard activation has no mousedown; capture the click before the command executes.
        renderer.toolbarElement?.addEventListener('click', keepSelection, true)
        const focus = event => callbacksRef.current.onFocus?.(event)
        const blur = event => callbacksRef.current.onBlur?.(event)
        const blockDisabledEdit = event => {
            if (renderer.disabled) { event.preventDefault(); event.stopImmediatePropagation() }
        }
        const editEvents = ['beforeinput', 'input', 'paste', 'drop', 'keydown', 'contextmenu']
        editEvents.forEach(name => element.addEventListener(name, blockDisabledEdit, true))
        element.addEventListener('focus', focus)
        element.addEventListener('blur', blur)
        return () => {
            element.removeEventListener('focus', focus)
            element.removeEventListener('blur', blur)
            editEvents.forEach(name => element.removeEventListener(name, blockDisabledEdit, true))
            renderer.toolbarElement?.removeEventListener('mousedown', keepSelection)
            renderer.toolbarElement?.removeEventListener('click', keepSelection, true)
            renderer.closeLinkDialog()
            renderer.destroy()
            editorRef.current = null
        }
    }, [id, inlineOnly])

    useEffect(() => {
        if (value !== undefined && value !== lastValueRef.current) {
            lastValueRef.current = value
            editorRef.current?.closeLinkDialog()
            editorRef.current?.updateConfig({ content: DOMPurify.sanitize(value || '') })
        }
    }, [value])
    useEffect(() => {
        const renderer = editorRef.current
        if (!renderer) return
        renderer.namespace = namespace
        renderer.disabled = disabled
        if (disabled) renderer.closeLinkDialog()
        renderer.pageId = context?.pageId
        renderer.siteRootId = context?.siteRootId || context?.webpageData?.cachedRootId
        renderer.editorElement.contentEditable = String(!disabled)
        renderer.editorElement.setAttribute('contenteditable', String(!disabled))
        renderer.editorElement.setAttribute('aria-disabled', String(disabled))
        renderer.editorElement.setAttribute('aria-required', String(Boolean(required)))
        renderer.editorElement.setAttribute('aria-invalid', String(Boolean(validation?.errors?.length)))
        renderer.editorElement.style.minHeight = `${Math.max(2, rows) * 1.5}rem`
        renderer.toolbarElement?.querySelectorAll('button, select').forEach(control => { control.disabled = disabled })
    }, [disabled, required, validation, rows, namespace, context, inlineOnly])

    return <div className="space-y-2">
        {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}{required && ' *'}</label>}
        <FieldHelpText>{description}</FieldHelpText>
        <div ref={containerRef} className="overflow-hidden rounded-md border border-gray-300 bg-white text-gray-900 focus-within:ring-2 focus-within:ring-blue-500" />
        {validation?.errors?.map((error, index) => <div role="alert" key={index} className="text-sm text-red-600">{error}</div>)}
        {validation?.warnings?.map((warning, index) => <div key={index} className="text-sm text-yellow-700">{warning}</div>)}
    </div>
}

// Every HTML-valued field needs the same lossless path, including nested richtext fields.
const RichTextInput = ({ value, defaultValue = '', onChange, disabled, showSourceButton = false, inlineOnly = false, ...props }) => {
    const [sourceOpen, setSourceOpen] = useState(false)
    const html = value ?? defaultValue
    const sourceOnly = useMemo(() => requiresHtmlSource(html, inlineOnly), [html, inlineOnly])
    useEffect(() => { if (disabled) setSourceOpen(false) }, [disabled])
    return <div className="space-y-2">
        {sourceOnly
            ? <>
                {props.label && <div className="text-sm font-medium text-gray-700">{props.label}{props.required && ' *'}</div>}
                <FieldHelpText>{props.description}</FieldHelpText>
                <p className="text-sm text-gray-600">Use the HTML editor to preserve this content without removing markup.</p>
            </>
            : <RichTextEditor {...props} value={value} defaultValue={defaultValue} onChange={onChange} disabled={disabled} inlineOnly={inlineOnly} />}
        {(sourceOnly || showSourceButton) && <button type="button" disabled={disabled} onClick={() => setSourceOpen(true)}
            className="text-sm text-gray-600 underline focus-visible:outline focus-visible:outline-2">
            Open HTML Editor
        </button>}
        {sourceOpen && !disabled && <HtmlEditor value={html || ''}
            onChange={next => { if (!disabled) onChange?.(next) }} onClose={() => setSourceOpen(false)} />}
    </div>
}

export default RichTextInput
