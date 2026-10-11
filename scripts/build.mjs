import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const check = process.argv.includes('--check');
const digest = data => createHash('sha256').update(data).digest('hex');
const cspDigest = data => `'sha256-${createHash('sha256').update(data).digest('base64')}'`;
const escapeHtml = data => data.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const bundle = await build({ entryPoints: ['src/app.ts'], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', minify: false, legalComments: 'inline', charset: 'utf8', sourcemap: false, metafile: true, logLevel: 'warning' });
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
if (/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker)\s*[.(]/.test(js)) throw new Error('Unexpected network or persistence API in application bundle.');
const css = (await readFile('src/styles.css', 'utf8')).replace(/^@charset[^;]*;\s*/, '');
const packages = new Map();
for (const path of Object.keys(bundle.metafile.inputs).sort()) {
  if (!path.startsWith('node_modules/')) continue;
  const parts = path.slice(13).split('/');
  const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  if (packages.has(name)) continue;
  const directory = join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  let license;
  for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    try { license = await readFile(join(directory, filename), 'utf8'); break; } catch { /* try next */ }
  }
  if (!license) throw new Error(`Missing license for ${name}`);
  packages.set(name, `${name}@${pkg.version}\n${'='.repeat(64)}\n${license.trim()}\n`);
}
const notices = `EntropyCheck 1.0.0\n\n${await readFile('LICENSE', 'utf8')}\n\nPublic BIP39 examples — trezor/python-mnemonic\n\n${await readFile('tests/fixtures/TREZOR_LICENSE', 'utf8')}\n\nBundled dependency licenses\n\n${[...packages.values()].join('\n')}\n`;
const csp = `default-src 'none'; script-src ${cspDigest(js)}; style-src ${cspDigest(css)}; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`;
const template = await readFile('src/index.html', 'utf8');
// Function replacements preserve literal "$" characters in bundled code.
const html = template.replace('__CSP__', () => csp).replace('__CSS__', () => css).replace('__JS__', () => js).replace('__LICENSES__', () => escapeHtml(notices));
const checksums = `${digest(html)}  entropycheck.html\n`;
const artifacts = new Map([['entropycheck.html', html], ['SHA256SUMS', checksums], ['THIRD_PARTY_NOTICES.txt', notices]]);
for (const [path, content] of artifacts) {
  if (check) {
    const actual = await readFile(path, 'utf8');
    if (actual !== content) throw new Error(`${path} differs from source. Run npm run build and commit regenerated artifacts.`);
  } else await writeFile(path, content);
}
// Pages serves exactly the same bytes as the offline file.
if (!check) {
  await mkdir('dist', { recursive: true });
  await Promise.all([writeFile('dist/index.html', html), writeFile('dist/entropycheck.html', html), writeFile('dist/SHA256SUMS', checksums), writeFile('dist/.nojekyll', '')]);
}
console.log(`${check ? 'Verified' : 'Built'} standalone HTML (${Buffer.byteLength(html).toLocaleString('en-US')} bytes). SHA-256: ${digest(html)}`);
