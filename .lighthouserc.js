module.exports = {
    ci: {
        collect: {
            // Number of runs to perform for each URL
            numberOfRuns: 3,
            // Lighthouse settings
            settings: {
                // Run in headless Chrome
                chromeFlags: '--no-sandbox --disable-dev-shm-usage',
                // Preset configuration
                preset: 'desktop',
                // Additional settings
                onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
                // Skip certain audits that might be flaky in CI
                skipAudits: [
                    'screenshot-thumbnails',
                    'final-screenshot',
                    'largest-contentful-paint-element',
                ],
            },
            // URL patterns to test
            url: [
                'http://localhost:3000',
                'http://localhost:3000/page-management',
                'http://localhost:3000/settings',
            ],
        },
        assert: {
            // Performance thresholds
            assertions: {
                'categories:performance': ['warn', { minScore: 0.8 }],
                'categories:accessibility': ['error', { minScore: 0.9 }],
                'categories:best-practices': ['warn', { minScore: 0.8 }],
                'categories:seo': ['warn', { minScore: 0.8 }],

                // Specific metrics
                'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
                'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
                'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
                'total-blocking-time': ['warn', { maxNumericValue: 300 }],

                // Accessibility checks
                'color-contrast': 'error',
                'heading-order': 'error',
                'html-has-lang': 'error',
                'image-alt': 'error',
                'label': 'error',
                'link-name': 'error',

                // Best practices
                'uses-https': 'off', // Disabled for local testing
                'is-on-https': 'off', // Disabled for local testing
                'uses-http2': 'off', // Not applicable for local testing
            },
        },
        upload: {
            // Upload results to temporary server (can be configured for permanent storage)
            target: 'temporary-public-storage',
        },
        server: {
            // Local LHCI server configuration (optional)
            // Uncomment to use local server
            // target: 'lhci',
            // serverBaseUrl: 'http://localhost:9001',
            // token: 'your-token-here',
        },
    },
}; 