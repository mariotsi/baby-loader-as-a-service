#!/usr/bin/env node
// Checks that every Playwright Docker image the workflows run in matches the
// @playwright/test version in package.json. Each image ships the browsers of
// exactly one Playwright release, and a different @playwright/test looks for
// browser builds the image does not have.
// Run: node scripts/check-playwright-image.mjs   (CI runs it on every pull request)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS = '.github/workflows';
const IMAGE = /mcr\.microsoft\.com\/playwright:v([^\s'"-]+)/g;

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.devDependencies?.['@playwright/test'];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error(`package.json must pin @playwright/test to an exact version, found "${version}"`);
  process.exit(1);
}

const images = readdirSync(WORKFLOWS)
  .filter((file) => /\.ya?ml$/.test(file))
  .flatMap((file) => {
    const path = join(WORKFLOWS, file);
    return [...readFileSync(path, 'utf8').matchAll(IMAGE)].map((match) => ({ path, version: match[1] }));
  });

if (images.length === 0) {
  console.error(`No Playwright image found in ${WORKFLOWS}`);
  process.exit(1);
}
const mismatched = images.filter((image) => image.version !== version);
for (const image of mismatched) {
  console.error(`${image.path} runs Playwright image v${image.version}, package.json has @playwright/test ${version}`);
}
if (mismatched.length > 0) {
  process.exit(1);
}
console.log(`Playwright image matches @playwright/test ${version} in ${images.map((image) => image.path).join(', ')}`);
