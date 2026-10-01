import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const chunksDirectory = path.resolve('.next/static/chunks');

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(target) : target.endsWith('.js') ? [target] : [];
  }));
  return files.flat();
}

const rendererChunks = [];
for (const file of await javascriptFiles(chunksDirectory)) {
  const source = await readFile(file, 'utf8');
  if (source.includes('site-renderer cms-content')) rendererChunks.push({ file, source });
}

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

console.log(`Verified React JSX runtime in ${rendererChunks.length} publisher client bundle chunk(s).`);
