import path from 'node:path';
import type { NextConfig } from 'next';

const repositoryRoot = path.resolve(process.cwd(), '..');
const nextConfig: NextConfig = {
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
    // Shared renderer sources live outside publisher/, so their runtime imports
    // must resolve to the publisher's installed React packages. The matching
    // tsconfig paths are declaration-only and must not reach the client bundle.
    resolveAlias: {
      react: './node_modules/react',
      'react/jsx-runtime': './node_modules/react/jsx-runtime.js',
      'react-dom/server': './node_modules/react-dom/server.js',
    },
  },
};

export default nextConfig;
