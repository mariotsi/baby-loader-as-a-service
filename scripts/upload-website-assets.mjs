import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const bucket = process.env.R2_BUCKET;
if (!bucket) {
  throw new Error('R2_BUCKET must name the destination bucket');
}

const assetRoot = fileURLToPath(new URL('../public/website-assets/', import.meta.url));
const contentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

async function assetFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await assetFiles(path) : [path]));
  }
  return files;
}

const files = await assetFiles(assetRoot);
if (files.length === 0) {
  throw new Error('public/website-assets contains no files');
}

for (const file of files) {
  const extension = extname(file).toLowerCase();
  const contentType = contentTypes.get(extension);
  if (!contentType) {
    throw new Error(`Unsupported website asset type: ${relative(assetRoot, file)}`);
  }

  const key = relative(assetRoot, file).split(sep).join('/');
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/website-assets/${key}`,
      '--file',
      file,
      '--remote',
      '--content-type',
      contentType,
      '--cache-control',
      'public, max-age=31536000, immutable',
    ],
    { stdio: 'inherit' }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
