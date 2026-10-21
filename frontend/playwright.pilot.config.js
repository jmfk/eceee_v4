import { defineConfig, devices } from '@playwright/test'

// The baseline runner uses this port inside an isolated container, never on the host.
const port = Number(process.env.PILOT_BROWSER_PORT || 3000)
export default defineConfig({
    testDir: './e2e',
    testMatch: 'pilot-baseline.spec.js',
    forbidOnly: true,
    retries: 0,
    workers: 1,
    reporter: [['list'], ['json', { outputFile: process.env.PILOT_BROWSER_REPORT || 'test-results/pilot/report.json' }]],
    outputDir: process.env.PILOT_BROWSER_ARTIFACTS || 'test-results/pilot/artifacts',
    use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    webServer: {
        command: `npx vite --config vite.pilot.config.js --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}/e2e/fixtures/pilot-baseline.html`,
        reuseExistingServer: false,
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
        { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    ],
})
