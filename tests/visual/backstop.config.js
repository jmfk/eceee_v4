/**
 * BackstopJS Configuration for Unified Widget System Visual Regression Testing
 * 
 * This configuration defines visual regression test scenarios for all widget types
 * across different viewports and states.
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const apiUrl = process.env.API_BASE_URL || 'http://localhost:8000';

// Test scenarios for each widget type
const widgetScenarios = [
    // Text Block Widget
    {
        label: 'Text Block Widget - Default',
        url: `${baseUrl}/test/widgets/text-block?config=default`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Text Block Widget - Center Aligned',
        url: `${baseUrl}/test/widgets/text-block?config=center`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Text Block Widget - Right Aligned',
        url: `${baseUrl}/test/widgets/text-block?config=right`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Text Block Widget - With HTML Content',
        url: `${baseUrl}/test/widgets/text-block?config=html`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },

    // Image Widget
    {
        label: 'Image Widget - Default',
        url: `${baseUrl}/test/widgets/image?config=default`,
        selectors: ['.widget-container'],
        delay: 2000, // Allow time for image loading
        misMatchThreshold: 0.1
    },
    {
        label: 'Image Widget - With Caption',
        url: `${baseUrl}/test/widgets/image?config=with-caption`,
        selectors: ['.widget-container'],
        delay: 2000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Image Widget - Responsive',
        url: `${baseUrl}/test/widgets/image?config=responsive`,
        selectors: ['.widget-container'],
        delay: 2000,
        misMatchThreshold: 0.1
    },

    // Button Widget
    {
        label: 'Button Widget - Primary',
        url: `${baseUrl}/test/widgets/button?config=primary`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Button Widget - Secondary',
        url: `${baseUrl}/test/widgets/button?config=secondary`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Button Widget - Large',
        url: `${baseUrl}/test/widgets/button?config=large`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },

    // Gallery Widget
    {
        label: 'Gallery Widget - Grid Layout',
        url: `${baseUrl}/test/widgets/gallery?config=grid`,
        selectors: ['.widget-container'],
        delay: 3000, // Allow time for multiple images
        misMatchThreshold: 0.2
    },
    {
        label: 'Gallery Widget - Carousel',
        url: `${baseUrl}/test/widgets/gallery?config=carousel`,
        selectors: ['.widget-container'],
        delay: 3000,
        misMatchThreshold: 0.2
    },

    // HTML Block Widget
    {
        label: 'HTML Block Widget - Basic',
        url: `${baseUrl}/test/widgets/html-block?config=basic`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'HTML Block Widget - Complex',
        url: `${baseUrl}/test/widgets/html-block?config=complex`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },

    // Spacer Widget
    {
        label: 'Spacer Widget - Small',
        url: `${baseUrl}/test/widgets/spacer?config=small`,
        selectors: ['.widget-container'],
        delay: 500,
        misMatchThreshold: 0.1
    },
    {
        label: 'Spacer Widget - Large',
        url: `${baseUrl}/test/widgets/spacer?config=large`,
        selectors: ['.widget-container'],
        delay: 500,
        misMatchThreshold: 0.1
    }
];

// Page editor scenarios
const editorScenarios = [
    {
        label: 'Page Editor - Empty State',
        url: `${baseUrl}/pages/new`,
        selectors: ['[data-testid="page-editor"]'],
        delay: 2000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Page Editor - With Widgets',
        url: `${baseUrl}/test/pages/with-widgets`,
        selectors: ['[data-testid="page-editor"]'],
        delay: 3000,
        misMatchThreshold: 0.2
    },
    {
        label: 'Widget Library Modal',
        url: `${baseUrl}/test/widget-library`,
        selectors: ['[data-testid="widget-library"]'],
        delay: 2000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Widget Configuration Form',
        url: `${baseUrl}/test/widget-config/text-block`,
        selectors: ['[data-testid="widget-config-form"]'],
        delay: 1500,
        misMatchThreshold: 0.1
    },
    {
        label: 'Slot Manager',
        url: `${baseUrl}/test/slot-manager`,
        selectors: ['[data-testid="slot-manager"]'],
        delay: 2000,
        misMatchThreshold: 0.1
    }
];

// Responsive scenarios
const responsiveScenarios = [
    {
        label: 'Responsive Text Block - Mobile',
        url: `${baseUrl}/test/widgets/text-block?config=responsive`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1,
        viewports: ['phone']
    },
    {
        label: 'Responsive Gallery - Tablet',
        url: `${baseUrl}/test/widgets/gallery?config=responsive`,
        selectors: ['.widget-container'],
        delay: 3000,
        misMatchThreshold: 0.2,
        viewports: ['tablet']
    },
    {
        label: 'Page Editor - Mobile',
        url: `${baseUrl}/test/pages/mobile-editor`,
        selectors: ['[data-testid="page-editor"]'],
        delay: 3000,
        misMatchThreshold: 0.2,
        viewports: ['phone']
    }
];

// Theme variation scenarios
const themeScenarios = [
    {
        label: 'Dark Theme - Text Block',
        url: `${baseUrl}/test/widgets/text-block?theme=dark`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'Dark Theme - Button Widget',
        url: `${baseUrl}/test/widgets/button?theme=dark`,
        selectors: ['.widget-container'],
        delay: 1000,
        misMatchThreshold: 0.1
    },
    {
        label: 'High Contrast Theme - Gallery',
        url: `${baseUrl}/test/widgets/gallery?theme=high-contrast`,
        selectors: ['.widget-container'],
        delay: 3000,
        misMatchThreshold: 0.2
    }
];

// Error state scenarios
const errorScenarios = [
    {
        label: 'Widget Error State - Invalid Config',
        url: `${baseUrl}/test/widgets/error-states/invalid-config`,
        selectors: ['.widget-container'],
        delay: 1500,
        misMatchThreshold: 0.1
    },
    {
        label: 'Widget Error State - Network Error',
        url: `${baseUrl}/test/widgets/error-states/network-error`,
        selectors: ['.widget-container'],
        delay: 1500,
        misMatchThreshold: 0.1
    },
    {
        label: 'Page Editor - Load Error',
        url: `${baseUrl}/test/pages/load-error`,
        selectors: ['[data-testid="page-editor"]'],
        delay: 2000,
        misMatchThreshold: 0.1
    }
];

// Combine all scenarios
const allScenarios = [
    ...widgetScenarios,
    ...editorScenarios,
    ...responsiveScenarios,
    ...themeScenarios,
    ...errorScenarios
];

// Viewport configurations
const viewports = [
    {
        label: 'phone',
        width: 375,
        height: 667
    },
    {
        label: 'tablet',
        width: 768,
        height: 1024
    },
    {
        label: 'desktop',
        width: 1440,
        height: 900
    },
    {
        label: 'desktop-xl',
        width: 1920,
        height: 1080
    }
];

// BackstopJS configuration
module.exports = {
    id: 'eceee_v4_unified_widgets',
    viewports: viewports,
    scenarios: allScenarios,
    paths: {
        bitmaps_reference: 'tests/visual/reference',
        bitmaps_test: 'tests/visual/test',
        html_report: 'tests/visual/report',
        ci_report: 'tests/visual/ci_report'
    },
    report: ['browser', 'CI'],
    engine: 'puppeteer',
    engineOptions: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        headless: true,
        devtools: false,
        timeout: 30000
    },
    asyncCaptureLimit: 5,
    asyncCompareLimit: 50,
    debug: false,
    debugWindow: false,

    // Global configuration for all scenarios
    onBeforeScript: 'tests/visual/scripts/onBefore.js',
    onReadyScript: 'tests/visual/scripts/onReady.js',

    // Resemblejs configuration for image comparison
    resembleOutputOptions: {
        errorColor: {
            red: 255,
            green: 0,
            blue: 255
        },
        errorType: 'movement',
        transparency: 0.3,
        largeImageThreshold: 1200,
        useCrossOrigin: false,
        outputDiff: true
    },

    // Advanced configuration
    requireSameDimensions: false,

    // CI/CD integration
    ciReport: {
        format: 'junit',
        testReportFileName: 'visual-regression-results',
        testSuiteName: 'Visual Regression Tests'
    }
};
