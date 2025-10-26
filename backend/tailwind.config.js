/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './templates/**/*.html',
        './eceee_layouts/templates/**/*.html',
        './eceee_widgets/templates/**/*.html',
        './file_manager/templates/**/*.html',
        './htmx/templates/**/*.html',
        './object_storage/templates/**/*.html',
        './webpages/templates/**/*.html',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Source Sans 3', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
            },
            fontSize: {
                // Hero typography
                'hero-h1': ['54px', '65px'],

                // Sidebar typography
                'sidebar-h4': ['18px', '22px'],
                'sidebar-p': ['14px', '17px'],
                'sidebar-li': ['14px', '17px'],
            },
            spacing: {
                'text': '22px', // Standard bottom margin for typography elements
            },
        },
    },
    plugins: [
        function ({ addBase }) {
            addBase({
                'img, video': {
                    'max-width': 'unset',
                    'height': 'unset', // Override Tailwind's default 'auto' to allow height utilities
                },
                // Set Source Sans 3 as the default font for the entire page
                'body': {
                    'font-family': '"Source Sans 3", ui-sans-serif, system-ui, -apple-system, sans-serif',
                },
                // Content typography - applied to unclassed HTML tags
                'h1': {
                    'font-size': '41px',
                    'line-height': '44px',
                    'font-weight': '600', // semibold
                    'margin-bottom': '11px',
                },
                'h2': {
                    'font-size': '36px',
                    'line-height': '43px',
                    'font-weight': '500', // medium
                    'margin-bottom': '11px',
                },
                'h3': {
                    'font-size': '22px',
                    'line-height': '26px',
                    'font-weight': '600', // bold
                    'margin-top': '22px',
                    'margin-bottom': '11px',
                },
                'p': {
                    'font-size': '16px',
                    'line-height': '22px',
                    'font-weight': '300', // light
                    'margin-bottom': '11px',
                },
                'ul': {
                    'margin-top': '11px',
                    'margin-bottom': '11px',
                    'padding-left': '1.5em',
                    'list-style-type': 'disc',
                },
                'ol': {
                    'margin-top': '11px',
                    'margin-bottom': '11px',
                    'padding-left': '1.5em',
                    'list-style-type': 'decimal',
                },
                'li': {
                    'font-size': '16px',
                    'line-height': '22px',
                    'font-weight': '300',
                    'line-height': '22px',
                },
                'a': {
                    'color': '#2563eb', // blue-600
                    'text-decoration': 'none',
                    '&:hover': {
                        'text-decoration': 'underline',
                    },
                },
            })
        }
    ],
}

