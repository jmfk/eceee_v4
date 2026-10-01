import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const chunksDirectory = path.resolve('.next/static/chunks');
const require = createRequire(import.meta.url);

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(target) : target.endsWith('.js') ? [target] : [];
  }));
  return files.flat();
}

const clientChunks = [];
for (const file of await javascriptFiles(chunksDirectory)) {
  const source = await readFile(file, 'utf8');
  clientChunks.push({ file, source });
}

const rendererChunks = clientChunks.filter(({ source }) => source.includes('site-renderer cms-content'));

if (rendererChunks.length === 0) {
  throw new Error('Publisher client bundle does not contain the shared page renderer.');
}

for (const { file, source } of rendererChunks) {
  if (source.includes('(void 0)(')) {
    throw new Error(`Publisher client bundle contains an undefined function call in ${path.relative(process.cwd(), file)}.`);
  }
  if (!/\.(?:jsx|jsxs)\)\(/.test(source)) {
    throw new Error(`Publisher client bundle has no React JSX runtime calls in ${path.relative(process.cwd(), file)}.`);
  }
}

const bundledVersions = new Set([
  require('next/dist/compiled/react').version,
  require('next/dist/compiled/react-dom').version,
]);
if (bundledVersions.size !== 1) {
  throw new Error(`Next bundles incompatible React runtimes: ${[...bundledVersions].join(', ')}.`);
}

const bundledVersion = [...bundledVersions][0];
const standaloneVersions = new Set([require('react').version, require('react-dom').version]);
const allClientSource = clientChunks.map(({ source }) => source).join('\n');
const includesExactVersion = version => new RegExp(`["']${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(allClientSource);
const conflictingVersions = [...standaloneVersions]
  .filter(version => version !== bundledVersion && includesExactVersion(version));

if (includesExactVersion(bundledVersion) && conflictingVersions.length > 0) {
  throw new Error(
    `Publisher client bundle mixes Next's React ${bundledVersion} with standalone React ${conflictingVersions.join(', ')}.`,
  );
}

console.log(
  `Verified Next React ${bundledVersion} and JSX runtime in ${rendererChunks.length} publisher client bundle chunk(s).`,
);
