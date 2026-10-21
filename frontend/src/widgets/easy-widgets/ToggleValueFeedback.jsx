import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import './toggle-value-feedback.css'

// Announce the selected value without moving focus or intercepting editor clicks.
export function useToggleValueFeedback() {
    const [feedback, setFeedback] = useState(null)
    const controlId = useId()
    useEffect(() => {
        // All controls share the same screen position; only the latest may show.
        const replaceFeedback = event => {
            if (event.detail !== controlId) setFeedback(null)
        }
        window.addEventListener('eceee-toggle-value', replaceFeedback)
        return () => window.removeEventListener('eceee-toggle-value', replaceFeedback)
    }, [controlId])
    const showValue = label => {
        window.dispatchEvent(new CustomEvent('eceee-toggle-value', { detail: controlId }))
        setFeedback(previous => ({ label, id: (previous?.id || 0) + 1 }))
    }
    const valueFeedback = feedback && createPortal(
        <div key={feedback.id} role="status" aria-live="polite" aria-atomic="true"
            className="eceee-editor-ui toggle-value-feedback"
            onAnimationEnd={() => setFeedback(current => current === feedback ? null : current)}>
            {feedback.label}
        </div>, document.body)
    return { showValue, valueFeedback }
}
