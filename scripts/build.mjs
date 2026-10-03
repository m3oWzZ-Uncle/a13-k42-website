import { mkdir, readFile, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
const html = await readFile(path.join(source, 'index.html'), 'utf8');
if (!/<!doctype html>/i.test(html) || !/<html\b[^>]*lang="vi"/i.test(html)) {
  throw new Error('Missing HTML document or Vietnamese language declaration.');
}
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const reference = match[1];
  if (reference === '#') continue;
  if (reference.startsWith('#')) {
    if (!ids.has(reference.slice(1))) throw new Error(`Missing anchor: ${reference}`);
    continue;
  }
  if (/^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
  const localPath = path.resolve(source, reference.split(/[?#]/)[0]);
  if (!localPath.startsWith(source + path.sep)) throw new Error(`Invalid local asset: ${reference}`);
  if (!(await stat(localPath)).isFile()) throw new Error(`Missing asset: ${reference}`);
}
async function copyDirectory(from, to) {
  await mkdir(to, { recursive: true });
  for (const item of await readdir(from, { withFileTypes: true })) {
    const input = path.join(from, item.name);
    const target = path.join(to, item.name);
    if (item.isDirectory()) await copyDirectory(input, target);
    else if (item.isFile()) await copyFile(input, target);
  }
}
await copyDirectory(source, output);
console.log('Static build successful: source and local links checked, files copied to dist.');
