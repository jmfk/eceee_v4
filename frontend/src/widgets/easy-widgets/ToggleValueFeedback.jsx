import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import './toggle-value-feedback.css'

// Announce the selected value without moving focus or intercepting editor clicks.
export function useToggleValueFeedback() {
    const [feedback, setFeedback] = useState(null)
    const showValue = label => setFeedback(previous => ({ label, id: (previous?.id || 0) + 1 }))
    const valueFeedback = feedback && createPortal(
        <div key={feedback.id} role="status" aria-live="polite" aria-atomic="true"
            className="eceee-editor-ui toggle-value-feedback"
            onAnimationEnd={() => setFeedback(current => current === feedback ? null : current)}>
            {feedback.label}
        </div>, document.body)
    return { showValue, valueFeedback }
}
