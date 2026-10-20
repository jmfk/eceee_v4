import React, { useEffect, useMemo, useState } from 'react'
import { HtmlEditor } from './HtmlEditor'
import RichTextInput from '../form-fields/RichTextInput'
import { requiresHtmlSource } from '../../utils/richTextFieldHtml'

/** HTML fields share the same form ownership as other inputs; source editing is an optional view. */
const HtmlSourceField = ({ value, onChange, disabled, ...props }: any) => {
    const [sourceOpen, setSourceOpen] = useState(false)
    const sourceOnly = useMemo(() => requiresHtmlSource(value), [value])
    useEffect(() => { if (disabled) setSourceOpen(false) }, [disabled])
    return <div className="space-y-2">
        {sourceOnly
            ? <p className="text-sm text-gray-600">Use the HTML editor to preserve scripts and embedded content.</p>
            : <RichTextInput {...props} value={value} onChange={onChange} disabled={disabled} />}
        <button type="button" disabled={disabled} onClick={() => setSourceOpen(true)}
            className="text-sm text-gray-600 underline focus-visible:outline focus-visible:outline-2">
            Open HTML Editor
        </button>
        {sourceOpen && !disabled && <HtmlEditor value={value || ''}
            onChange={html => { if (!disabled) onChange(html) }} onClose={() => setSourceOpen(false)} />}
    </div>
}

export default HtmlSourceField
