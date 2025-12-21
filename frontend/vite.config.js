import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
  },

  // CSS configuration
  css: {
    devSourcemap: true,
  },
})