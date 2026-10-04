import { mkdir, readFile, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

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
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (Boolean(url) !== Boolean(key)) throw new Error('Both Supabase public configuration values are required.');
if (url && !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)) throw new Error('Use the Supabase project HTTPS URL.');
if (key && !key.startsWith('sb_publishable_')) {
  throw new Error('Use a Supabase publishable key (sb_publishable_), never a secret or service-role key.');
}
await build({
  entryPoints: [path.join(source, 'account.js')],
  outfile: path.join(output, 'account.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  plugins: [{ name: 'public-config', setup(builder) {
    builder.onLoad({ filter: /auth-config\.js$/ }, () => ({
      contents: `export const authConfig = ${JSON.stringify({ url, key })};`, loader: 'js'
    }));
  }}]
});
// auth-config.js in dist remains a blank template; actual public config is bundled.
console.log(`Build successful. Google sign-in configuration: ${url ? 'present' : 'not connected yet'}.`);
