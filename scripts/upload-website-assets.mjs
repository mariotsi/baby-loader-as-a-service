import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AwsClient } from 'aws4fetch';

const {
  R2_BUCKET: bucket,
  R2_ENDPOINT: endpoint,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secretAccessKey,
} = process.env;
if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error('R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required');
}
const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });

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
  const url = new URL(
    `${encodeURIComponent(bucket)}/website-assets/${key.split('/').map(encodeURIComponent).join('/')}`,
    `${endpoint.replace(/\/$/, '')}/`
  );
  const response = await client.fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: await readFile(file),
  });
  if (!response.ok) {
    throw new Error(`Website asset upload failed (${response.status}): ${key}`);
  }
  console.log(`Uploaded website-assets/${key}`);
}
