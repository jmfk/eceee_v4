import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    testMatch: 'kanban.spec.js',
    timeout: 30000,
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:12900',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
