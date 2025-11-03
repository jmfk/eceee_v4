/**
 * Code Insertion Utilities
 * 
 * Helper functions for inserting preset templates and CSS into style editors.
 * Handles smart merging, deduplication, and formatting.
 */

/**
 * Insert template code into existing template
 * @param {string} existingTemplate - Current template content
 * @param {string} newTemplate - Template to insert
 * @param {string} mode - 'replace' or 'append'
 * @returns {string} Combined template
 */
export const insertTemplate = (existingTemplate, newTemplate, mode = 'replace') => {
    if (mode === 'replace') {
        return newTemplate;
    }

    // Append mode: add newTemplate to end with spacing
    const trimmedExisting = (existingTemplate || '').trim();
    const trimmedNew = (newTemplate || '').trim();

    if (!trimmedExisting) return trimmedNew;
    if (!trimmedNew) return trimmedExisting;

    return `${trimmedExisting}\n\n${trimmedNew}`;
};

/**
 * Insert CSS code into existing CSS with smart deduplication
 * @param {string} existingCSS - Current CSS content
 * @param {string} newCSS - CSS to insert
 * @param {string} mode - 'replace' or 'append'
 * @returns {string} Combined CSS
 */
export const insertCSS = (existingCSS, newCSS, mode = 'replace') => {
    if (mode === 'replace') {
        return newCSS;
    }

    // Append mode: merge CSS with deduplication
    const trimmedExisting = (existingCSS || '').trim();
    const trimmedNew = (newCSS || '').trim();

    if (!trimmedExisting) return trimmedNew;
    if (!trimmedNew) return trimmedExisting;

    // Simple deduplication: check if new CSS already exists
    if (trimmedExisting.includes(trimmedNew)) {
        return trimmedExisting;
    }

    return `${trimmedExisting}\n\n${trimmedNew}`;
};

/**
 * Extract CSS selectors from CSS string
 * @param {string} css - CSS content
 * @returns {Set<string>} Set of selector names
 */
export const extractCSSSelectors = (css) => {
    const selectors = new Set();
    const regex = /([.#]?[\w-]+)\s*\{/g;
    let match;

    while ((match = regex.exec(css)) !== null) {
        selectors.add(match[1].trim());
    }

    return selectors;
};

/**
 * Merge CSS with intelligent deduplication
 * Removes duplicate selectors, keeping the newer version
 * @param {string} existingCSS - Current CSS content
 * @param {string} newCSS - New CSS to merge
 * @returns {string} Merged CSS
 */
export const mergeCSS = (existingCSS, newCSS) => {
    const trimmedExisting = (existingCSS || '').trim();
    const trimmedNew = (newCSS || '').trim();

    if (!trimmedExisting) return trimmedNew;
    if (!trimmedNew) return trimmedExisting;

    // Extract selectors from new CSS
    const newSelectors = extractCSSSelectors(trimmedNew);

    // Remove duplicate selectors from existing CSS
    let filteredExisting = trimmedExisting;
    newSelectors.forEach(selector => {
        // Create regex to match selector block
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`, 'g');
        filteredExisting = filteredExisting.replace(regex, '');
    });

    // Clean up extra whitespace
    filteredExisting = filteredExisting.replace(/\n{3,}/g, '\n\n').trim();

    if (!filteredExisting) return trimmedNew;

    return `${filteredExisting}\n\n${trimmedNew}`;
};

/**
 * Format code with basic indentation
 * @param {string} code - Code to format
 * @param {string} type - 'html' or 'css'
 * @returns {string} Formatted code
 */
export const formatCode = (code, type = 'html') => {
    if (!code) return '';

    // Basic formatting: ensure consistent line breaks
    let formatted = code.trim();

    if (type === 'html') {
        // Ensure tags are on new lines (basic formatting)
        formatted = formatted
            .replace(/>\s*</g, '>\n<')
            .replace(/\n{3,}/g, '\n\n');
    } else if (type === 'css') {
        // Ensure selectors and rules are properly spaced
        formatted = formatted
            .replace(/}\s*/g, '}\n\n')
            .replace(/\{/g, ' {\n  ')
            .replace(/;/g, ';\n  ')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .replace(/\s+}/g, '\n}');
    }

    return formatted;
};

/**
 * Check if template contains lightbox functionality
 * @param {string} template - HTML template
 * @returns {boolean} True if lightbox elements found
 */
export const hasLightbox = (template) => {
    if (!template) return false;
    return template.includes('lightbox') || template.includes('modal');
};

/**
 * Check if template contains carousel buttons
 * @param {string} template - HTML template
 * @returns {boolean} True if carousel buttons found
 */
export const hasCarouselButtons = (template) => {
    if (!template) return false;
    return (
        template.includes('carousel-btn') ||
        template.includes('carousel-prev') ||
        template.includes('carousel-next')
    );
};

/**
 * Replace carousel buttons in template
 * Finds existing button elements and replaces them with new button template
 * @param {string} template - Current template
 * @param {string} newButtons - New button template
 * @returns {string} Updated template
 */
export const replaceCarouselButtons = (template, newButtons) => {
    if (!template || !newButtons) return template;

    // Pattern to match carousel button groups
    const buttonPatterns = [
        // Match button elements with carousel classes
        /<button[^>]*class="[^"]*carousel-(btn|prev|next)[^"]*"[^>]*>.*?<\/button>\s*<button[^>]*class="[^"]*carousel-(btn|prev|next)[^"]*"[^>]*>.*?<\/button>/gs,
        // Match paired buttons
        /<button[^>]*carousel-prev[^>]*>.*?<\/button>\s*<button[^>]*carousel-next[^>]*>.*?<\/button>/gs,
    ];

    let result = template;
    for (const pattern of buttonPatterns) {
        if (pattern.test(result)) {
            result = result.replace(pattern, newButtons);
            break;
        }
    }

    return result;
};

/**
 * Append lightbox to gallery template
 * Adds lightbox modal markup to the end of a gallery template
 * @param {string} galleryTemplate - Gallery template
 * @param {string} lightboxTemplate - Lightbox template to append
 * @returns {string} Combined template
 */
export const appendLightboxToGallery = (galleryTemplate, lightboxTemplate) => {
    if (!galleryTemplate) return lightboxTemplate;
    if (!lightboxTemplate) return galleryTemplate;

    // Check if lightbox already exists
    if (hasLightbox(galleryTemplate)) {
        // Replace existing lightbox
        const lightboxPattern = /<!--.*?[Ll]ightbox.*?-->.*?<div[^>]*lightbox[^>]*>.*?<\/div>/gs;
        if (lightboxPattern.test(galleryTemplate)) {
            return galleryTemplate.replace(lightboxPattern, lightboxTemplate);
        }
    }

    // Append to end
    return `${galleryTemplate.trim()}\n\n${lightboxTemplate.trim()}`;
};

/**
 * Smart insert for gallery styles with lightbox support
 * @param {Object} params
 * @param {string} params.existingTemplate - Current template
 * @param {string} params.existingCSS - Current CSS
 * @param {string} params.newTemplate - New template to insert
 * @param {string} params.newCSS - New CSS to insert
 * @param {string} params.mode - 'replace' or 'append'
 * @param {string} params.presetCategory - Category of preset being inserted
 * @returns {Object} { template, css }
 */
export const smartInsert = ({
    existingTemplate,
    existingCSS,
    newTemplate,
    newCSS,
    mode,
    presetCategory
}) => {
    let resultTemplate = existingTemplate;
    let resultCSS = existingCSS;

    if (presetCategory === 'lightbox' && mode === 'append') {
        // Special handling: append lightbox to gallery
        resultTemplate = appendLightboxToGallery(existingTemplate, newTemplate);
        resultCSS = mergeCSS(existingCSS, newCSS);
    } else if (presetCategory === 'buttons' && mode === 'append' && hasCarouselButtons(existingTemplate)) {
        // Special handling: replace carousel buttons
        resultTemplate = replaceCarouselButtons(existingTemplate, newTemplate);
        resultCSS = mergeCSS(existingCSS, newCSS);
    } else {
        // Standard insert
        resultTemplate = insertTemplate(existingTemplate, newTemplate, mode);
        resultCSS = insertCSS(existingCSS, newCSS, mode);
    }

    return {
        template: resultTemplate,
        css: resultCSS
    };
};

/**
 * Validate template syntax (basic check)
 * @param {string} template - Template to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateTemplate = (template) => {
    const errors = [];

    if (!template) {
        return { valid: true, errors: [] };
    }

    // Check for unclosed tags (basic)
    const openTags = (template.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (template.match(/<\/[^>]+>/g) || []).length;

    if (openTags !== closeTags) {
        errors.push('Mismatched HTML tags detected');
    }

    // Check for unclosed Mustache tags
    const openMustache = (template.match(/\{\{[^}]/g) || []).length;
    const closeMustache = (template.match(/[^{]\}\}/g) || []).length;

    if (openMustache !== closeMustache) {
        errors.push('Unclosed Mustache template tags');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Validate CSS syntax (basic check)
 * @param {string} css - CSS to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateCSS = (css) => {
    const errors = [];

    if (!css) {
        return { valid: true, errors: [] };
    }

    // Check for unclosed braces
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
        errors.push('Mismatched CSS braces');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Count lines in code
 * @param {string} code - Code content
 * @returns {number} Line count
 */
export const getLineCount = (code) => {
    if (!code) return 0;
    return code.split('\n').length;
};

/**
 * Get code statistics
 * @param {string} template - Template code
 * @param {string} css - CSS code
 * @returns {Object} Statistics
 */
export const getCodeStats = (template, css) => {
    return {
        templateLines: getLineCount(template),
        cssLines: getLineCount(css),
        templateChars: (template || '').length,
        cssChars: (css || '').length,
        hasLightbox: hasLightbox(template),
        hasButtons: hasCarouselButtons(template),
        cssSelectors: extractCSSSelectors(css).size
    };
};

