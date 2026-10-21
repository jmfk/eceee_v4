import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
    envDir: false,
    plugins: [react()],
    optimizeDeps: { entries: ['e2e/fixtures/pilot-baseline.html'] },
    cacheDir: '/tmp/eceee-pilot-vite-cache',
    server: {
        host: '127.0.0.1',
        fs: { allow: [root, path.resolve(root, '../backend/webpages/tests/fixtures/pilot_baseline')] },
    },
})
