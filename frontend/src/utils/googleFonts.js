/**
 * Google Fonts Integration Utility
 * 
 * Provides popular Google Fonts list, preview generation, and API URL building.
 */

// Popular Google Fonts (100+ most used fonts)
export const POPULAR_GOOGLE_FONTS = [
    { family: 'Source Sans 3', category: 'sans-serif', variants: ['200', '300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Inter', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800'] },
    { family: 'Roboto', category: 'sans-serif', variants: ['300', '400', '500', '700', '900'] },
    { family: 'Open Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800'] },
    { family: 'Lato', category: 'sans-serif', variants: ['300', '400', '700', '900'] },
    { family: 'Montserrat', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Poppins', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Raleway', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Nunito', category: 'sans-serif', variants: ['300', '400', '600', '700', '800', '900'] },
    { family: 'Ubuntu', category: 'sans-serif', variants: ['300', '400', '500', '700'] },
    { family: 'Playfair Display', category: 'serif', variants: ['400', '500', '600', '700', '800', '900'] },
    { family: 'Merriweather', category: 'serif', variants: ['300', '400', '700', '900'] },
    { family: 'PT Sans', category: 'sans-serif', variants: ['400', '700'] },
    { family: 'Nunito Sans', category: 'sans-serif', variants: ['300', '400', '600', '700', '800', '900'] },
    { family: 'Roboto Condensed', category: 'sans-serif', variants: ['300', '400', '700'] },
    { family: 'Oswald', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
    { family: 'Source Sans Pro', category: 'sans-serif', variants: ['300', '400', '600', '700', '900'] },
    { family: 'Mulish', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Quicksand', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
    { family: 'Noto Sans', category: 'sans-serif', variants: ['400', '700'] },
    { family: 'Rubik', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Work Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Manrope', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800'] },
    { family: 'Fira Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Karla', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800'] },
    { family: 'DM Sans', category: 'sans-serif', variants: ['400', '500', '700'] },
    { family: 'Bebas Neue', category: 'display', variants: ['400'] },
    { family: 'Bitter', category: 'serif', variants: ['400', '500', '600', '700', '800', '900'] },
    { family: 'Crimson Text', category: 'serif', variants: ['400', '600', '700'] },
    { family: 'Libre Baskerville', category: 'serif', variants: ['400', '700'] },
    { family: 'Lora', category: 'serif', variants: ['400', '500', '600', '700'] },
    { family: 'PT Serif', category: 'serif', variants: ['400', '700'] },
    { family: 'Cabin', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
    { family: 'Hind', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
    { family: 'IBM Plex Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
    { family: 'Titillium Web', category: 'sans-serif', variants: ['300', '400', '600', '700', '900'] },
    { family: 'Arimo', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
    { family: 'Barlow', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Prompt', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Inconsolata', category: 'monospace', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Source Code Pro', category: 'monospace', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'JetBrains Mono', category: 'monospace', variants: ['300', '400', '500', '600', '700', '800'] },
    { family: 'Fira Code', category: 'monospace', variants: ['300', '400', '500', '600', '700'] },
    { family: 'Oxygen', category: 'sans-serif', variants: ['300', '400', '700'] },
    { family: 'Heebo', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800', '900'] },
    { family: 'Comfortaa', category: 'display', variants: ['300', '400', '500', '600', '700'] },
    { family: 'Dancing Script', category: 'handwriting', variants: ['400', '500', '600', '700'] },
    { family: 'Pacifico', category: 'handwriting', variants: ['400'] },
    { family: 'Shadows Into Light', category: 'handwriting', variants: ['400'] },
    { family: 'Lobster', category: 'display', variants: ['400'] },
    { family: 'Anton', category: 'display', variants: ['400'] },
    { family: 'Righteous', category: 'display', variants: ['400'] },
];

/**
 * Generate Google Fonts URL from fonts configuration
 * @param {Array} fonts - Array of font objects with family, variants, display
 * @returns {string} Google Fonts URL
 */
export function buildGoogleFontsUrl(fonts) {
    if (!fonts || fonts.length === 0) {
        return null;
    }

    const fontFamilies = fonts.map(font => {
        const family = font.family.replace(/ /g, '+');
        const variants = font.variants || ['400'];
        const variantStr = variants.join(',');

        return `family=${family}:wght@${variantStr}`;
    });

    return `https://fonts.googleapis.com/css2?${fontFamilies.join('&')}&display=swap`;
}

/**
 * Load Google Fonts dynamically into the document
 * @param {string} fontsUrl - Google Fonts URL
 */
export function loadGoogleFonts(fontsUrl) {
    if (!fontsUrl) return;

    // Check if the fonts are already loaded
    const existingLink = document.querySelector(`link[href="${fontsUrl}"]`);
    if (existingLink) return;

    const link = document.createElement('link');
    link.href = fontsUrl;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    document.head.appendChild(link);
}

/**
 * Search for fonts by name
 * @param {string} query - Search query
 * @returns {Array} Filtered fonts
 */
export function searchFonts(query) {
    if (!query) return POPULAR_GOOGLE_FONTS;

    const lowerQuery = query.toLowerCase();
    return POPULAR_GOOGLE_FONTS.filter(font =>
        font.family.toLowerCase().includes(lowerQuery) ||
        font.category.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Get fonts by category
 * @param {string} category - Font category (sans-serif, serif, monospace, etc.)
 * @returns {Array} Filtered fonts
 */
export function getFontsByCategory(category) {
    if (!category) return POPULAR_GOOGLE_FONTS;

    return POPULAR_GOOGLE_FONTS.filter(font => font.category === category);
}

/**
 * Get font categories
 * @returns {Array} Unique categories
 */
export function getFontCategories() {
    const categories = [...new Set(POPULAR_GOOGLE_FONTS.map(font => font.category))];
    return categories.sort();
}

/**
 * Generate preview text for font
 * @param {string} fontFamily - Font family name
 * @returns {string} Preview text
 */
export function getFontPreviewText(fontFamily) {
    return `The quick brown fox jumps over the lazy dog`;
}

/**
 * Generate font face CSS
 * @param {Object} font - Font object
 * @returns {string} CSS font-face rules
 */
export function generateFontFaceCSS(font) {
    return `
    .preview-${font.family.replace(/ /g, '-').toLowerCase()} {
      font-family: '${font.family}', ${font.category};
    }
  `;
}

