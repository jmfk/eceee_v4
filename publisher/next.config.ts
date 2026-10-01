import path from 'node:path';
import type { NextConfig } from 'next';

const repositoryRoot = path.resolve(process.cwd(), '..');
const nextConfig: NextConfig = {
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
    // Shared renderer sources live outside publisher/, so their runtime imports
    // need explicit aliases instead of the declaration-only tsconfig paths.
    // App Router uses Next's bundled React canary, so every renderer import must
    // use that same runtime rather than the standalone stable React packages.
    resolveAlias: {
      react: './node_modules/next/dist/compiled/react',
      'react/jsx-runtime': './node_modules/next/dist/compiled/react/jsx-runtime.js',
      'react-dom/server': './node_modules/next/dist/compiled/react-dom/server.js',
    },
  },
};

export default nextConfig;
