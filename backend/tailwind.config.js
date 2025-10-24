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
        extend: {},
    },
    plugins: [
        function ({ addBase }) {
            addBase({
                'img, video': {
                    'max-width': 'unset',
                    'height': 'unset', // Override Tailwind's default 'auto' to allow height utilities
                }
            })
        }
    ],
}

