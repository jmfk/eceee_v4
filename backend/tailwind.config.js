/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './templates/**/*.html',
        './default_layouts/templates/**/*.html',
        './default_widgets/templates/**/*.html',
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
    plugins: [],
}

