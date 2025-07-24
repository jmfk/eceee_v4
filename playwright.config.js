import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests/e2e',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        ['html'],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['json', { outputFile: 'test-results/results.json' }],
        process.env.CI ? ['github'] : ['list']
    ],
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: process.env.BASE_URL || 'http://localhost:3000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Record video on failure */
        video: 'retain-on-failure',

        /* Ignore HTTPS errors */
        ignoreHTTPSErrors: true,

        /* Global timeout for each action */
        actionTimeout: 30000,

        /* Global timeout for navigation */
        navigationTimeout: 30000,
    },

    /* Configure projects for major browsers */
    projects: [
        // Setup project to seed the database
        {
            name: 'setup',
            testMatch: /.*\.setup\.js/,
        },

        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Use prepared auth state from setup
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        /* Test against mobile viewports. */
        {
            name: 'Mobile Chrome',
            use: {
                ...devices['Pixel 5'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'Mobile Safari',
            use: {
                ...devices['iPhone 12'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        /* Test against branded browsers. */
        {
            name: 'Microsoft Edge',
            use: {
                ...devices['Desktop Edge'],
                channel: 'msedge',
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'Google Chrome',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chrome',
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: process.env.CI ? undefined : [
        {
            command: 'docker-compose up backend',
            port: 8000,
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'docker-compose up frontend',
            port: 3000,
            reuseExistingServer: !process.env.CI,
        }
    ],

    /* Expect settings for visual regression testing */
    expect: {
        // Threshold for pixel difference in screenshots
        threshold: 0.3,
        // Animation handling
        toHaveScreenshot: {
            // Wait for fonts to load
            animations: 'disabled',
            // Clip images to avoid flaky differences
            clip: { x: 0, y: 0, width: 1280, height: 720 },
        },
        // Page comparison settings
        toMatchSnapshot: {
            threshold: 0.3,
            maxDiffPixels: 100,
        },
    },

    /* Global test timeout */
    timeout: 60000,

    /* Output directory for test results */
    outputDir: 'test-results/',
}); 