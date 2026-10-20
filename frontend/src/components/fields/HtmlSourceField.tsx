import React from 'react'
import RichTextInput from '../form-fields/RichTextInput'

/** HTML fields share the same form ownership as other inputs; source editing is an optional view. */
const HtmlSourceField = (props: any) => <RichTextInput {...props} showSourceButton />

export default HtmlSourceField
