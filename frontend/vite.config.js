import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const readGitHashFromGitDir = (gitDir) => {
  try {
    const headPath = path.join(gitDir, 'HEAD')

    if (!existsSync(headPath)) {
      return ''
    }

    const head = readFileSync(headPath, 'utf8').trim()

    if (!head.startsWith('ref:')) {
      return head.slice(0, 8)
    }

    const ref = head.replace('ref:', '').trim()
    const refPath = path.join(gitDir, ref)

    if (existsSync(refPath)) {
      return readFileSync(refPath, 'utf8').trim().slice(0, 8)
    }

    const packedRefsPath = path.join(gitDir, 'packed-refs')

    if (!existsSync(packedRefsPath)) {
      return ''
    }

    const packedRef = readFileSync(packedRefsPath, 'utf8')
      .split('\n')
      .find(line => line.endsWith(` ${ref}`))

    return packedRef ? packedRef.split(' ')[0].slice(0, 8) : ''
  } catch {
    return ''
  }
}

const getGitCommitHash = () => {
  const explicitHash = process.env.VITE_GIT_COMMIT_HASH || process.env.GIT_COMMIT_HASH || process.env.IMAGE_TAG

  if (explicitHash) {
    return explicitHash.trim()
  }

  const commands = [
    { command: 'git rev-parse --short HEAD', cwd: path.resolve(__dirname, '..') },
    { command: 'git --git-dir=/repo/.git rev-parse --short HEAD', cwd: __dirname },
  ]

  for (const { command, cwd } of commands) {
    try {
      const hash = execSync(command, {
        cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString().trim()

      if (hash) {
        return hash
      }
    } catch {
      // Continue through known dev/prod locations.
    }
  }

  const gitDirs = [
    path.resolve(__dirname, '..', '.git'),
    '/repo/.git',
  ]

  for (const gitDir of gitDirs) {
    const hash = readGitHashFromGitDir(gitDir)

    if (hash) {
      return hash
    }
  }

  return ''
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@api': path.resolve(__dirname, './src/api'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },

  // Development server configuration
  server: {
    host: '0.0.0.0', // Allow external connections for Docker
    port: 3000,
    allowedHosts: true, // Allow all hosts (dev only) to support custom hostnames like 'summerstudy'
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        timeout: 300000, // 5 minutes for large uploads
        proxyTimeout: 300000,
      },
      '/admin': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/imgproxy': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/csrf-token': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    watch: {
      usePolling: true, // Required for Docker on some systems
      interval: 1000,
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          ui: ['@headlessui/react', 'lucide-react'],
          state: ['zustand', '@tanstack/react-query'],
          http: ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(getGitCommitHash()),
  },

  // CSS configuration
  css: {
    devSourcemap: true,
  },
})
