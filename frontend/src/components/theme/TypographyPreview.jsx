/**
 * Typography Preview Component
 * 
 * Shows live preview of all HTML elements with current typography styling.
 */

import React, { useMemo } from 'react';
import { generateTypographyCSS, generateColorsCSS } from '../../utils/themeUtils';

const TypographyPreview = ({ typography, colors, widgetType = null, slot = null }) => {
    // Generate CSS for the preview
    const previewCSS = useMemo(() => {
        const colorCSS = generateColorsCSS(colors || {}, '.typography-preview');
        const typographyCSS = generateTypographyCSS(
            typography || {},
            colors || {},
            '.typography-preview',
            widgetType,
            slot
        );

        return `${colorCSS}\n\n${typographyCSS}`;
    }, [typography, colors, widgetType, slot]);

    return (
        <div className="typography-preview-container">
            <style>{previewCSS}</style>

            <div className="typography-preview bg-white border border-gray-300 rounded-lg p-6 space-y-4">
                <h1>Heading 1 - The Quick Brown Fox</h1>
                <h2>Heading 2 - Jumps Over the Lazy Dog</h2>
                <h3>Heading 3 - Typography Preview</h3>
                <h4>Heading 4 - Font Styling Examples</h4>
                <h5>Heading 5 - Smaller Heading</h5>
                <h6>Heading 6 - Smallest Heading</h6>

                <p>
                    This is a paragraph with some <strong>bold text</strong> and <em>italic text</em>.
                    Here's a <a href="#" onClick={(e) => e.preventDefault()}>link to somewhere</a> in the text.
                </p>

                <p>
                    Paragraphs can contain multiple sentences. This helps demonstrate line height,
                    letter spacing, and other typography properties that affect readability and
                    visual hierarchy in your content.
                </p>

                <ul>
                    <li>Unordered list item one</li>
                    <li>Unordered list item two with more content</li>
                    <li>Unordered list item three</li>
                </ul>

                <ol>
                    <li>Ordered list item one</li>
                    <li>Ordered list item two with more content</li>
                    <li>Ordered list item three</li>
                </ol>

                <blockquote>
                    This is a blockquote element. It's typically used for quotes or callouts
                    that need to stand out from the regular content.
                </blockquote>

                <p>
                    Here's some <code>inline code</code> within a paragraph, and below is a code block:
                </p>

                <pre><code>{`function example() {
  return "Hello, World!";
}`}</code></pre>
            </div>
        </div>
    );
};

export default TypographyPreview;

