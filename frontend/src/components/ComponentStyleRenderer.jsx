import React, { useEffect, useRef } from 'react'
import { renderMustache } from '../utils/mustacheRenderer'

/**
 * ComponentStyleRenderer
 * 
 * Renders Mustache templates with scoped CSS for Component Styles.
 * This ensures widgets with Component Styles render identically in the editor
 * as they do on the published site.
 */
const ComponentStyleRenderer = ({
    template,      // Mustache template string
    context = {},  // Template context data
    css = '',      // Scoped CSS
    styleId,       // Unique ID for scoping
    className = ''
}) => {
    const styleRef = useRef(null)

    // Render the Mustache template
    const html = renderMustache(template, context)

    // Inject scoped CSS
    useEffect(() => {
        if (!css || !styleId) return

        // Ensure css is a string
        const cssString = typeof css === 'string' ? css : ''
        if (!cssString) return

        // Create or update style element
        let styleElement = document.getElementById(`component-style-${styleId}`)

        if (!styleElement) {
            styleElement = document.createElement('style')
            styleElement.id = `component-style-${styleId}`
            document.head.appendChild(styleElement)
            styleRef.current = styleElement
        }

        // Scope CSS to this component
        const scopedCss = cssString.replace(
            /([^{}]+)\{/g,
            (match, selector) => {
                // Add data attribute to scope the CSS
                const trimmedSelector = selector.trim()
                if (trimmedSelector.startsWith('@') || trimmedSelector.startsWith('*')) {
                    // Don't scope @media, @keyframes, etc. or universal selector
                    return match
                }
                return `[data-style-id="${styleId}"] ${trimmedSelector} {`
            }
        )

        styleElement.textContent = scopedCss

        // Cleanup on unmount
        return () => {
            if (styleRef.current && styleRef.current.parentNode) {
                styleRef.current.parentNode.removeChild(styleRef.current)
            }
        }
    }, [css, styleId])

    return (
        <div
            className={`component-style-wrapper ${className}`}
            data-style-id={styleId}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )
}

export default ComponentStyleRenderer

