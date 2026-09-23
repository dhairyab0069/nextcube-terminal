// Builds the deployable site into _site/ and sanity-checks it.
// No dependencies; run with `node .github/scripts/build.mjs`.
//
// 1. Copies the site (minus repo-only files) into _site/.
// 2. Cache-busts: appends ?v=<sha> to the stylesheet, the entry module, and
//    every relative ES-module import, so a deploy never mixes cached and
//    fresh modules (GitHub Pages serves everything with max-age=600).
// 3. Writes _site/version.json for the front-end ("last deployed" etc.).
// 4. Fails the build if any local href/src/import points at a missing file
//    or any module has a syntax error.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '_site');
const EXCLUDE = new Set(['.git', '.github', '_site', 'node_modules', '.gitignore', '.DS_Store', 'README.md', '.claude', '.htmlvalidate.json', 'lychee.toml']);
const sha = (process.env.GITHUB_SHA || 'dev').slice(0, 8);
// Same-origin paths served by other repos' Pages sites (not in this build).
const OTHER_REPOS = [];
const errors = [];

// ── 1. copy ──
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (EXCLUDE.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true, filter: (src) => !EXCLUDE.has(path.basename(src)) });
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const files = walk(OUT);
const jsFiles = files.filter(f => f.endsWith('.js'));

// ── 2. cache-bust ──
const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"?]+?\.js)\2/g;
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, src.replace(IMPORT_RE, (_, kw, q, spec) => `${kw}${q}${spec}?v=${sha}${q}`));
}
const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/(href|src)="(\.\/[^"?#]+\.(?:css|js))"/g, (_, attr, url) => `${attr}="${url}?v=${sha}"`);
fs.writeFileSync(indexPath, html);

// ── 3. version.json ──
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({
  sha: process.env.GITHUB_SHA || 'dev',
  built_at: new Date().toISOString(),
  run_id: process.env.GITHUB_RUN_ID || null,
}, null, 2) + '\n');

// ── 4. checks ──
const exists = (fromFile, spec) => fs.existsSync(path.resolve(path.dirname(fromFile), spec.split(/[?#]/)[0]));

for (const m of html.matchAll(/(?:href|src)="(\.?\/?[^"#:]+?)(?:[?#][^"]*)?"/g)) {
  const url = m[1];
  if (!url || url.startsWith('//') || url.startsWith('data') || url === '/') continue;
  if (OTHER_REPOS.some(p => url.startsWith(p))) continue;
  if (!exists(indexPath, url.startsWith('/') ? '.' + url : url)) errors.push(`index.html → missing ${url}`);
}
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE_CHECK())) {
    if (!exists(file, m[3])) errors.push(`${path.relative(OUT, file)} → missing import ${m[3]}`);
  }
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'ignore', 'pipe'] });
  } catch (e) {
    errors.push(`${path.relative(OUT, file)} → syntax error\n${String(e.stderr).trim()}`);
  }
}
function IMPORT_RE_CHECK() { return /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+?)\2/g; }

for (const file of files.filter(f => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`${path.relative(OUT, file)} → invalid JSON: ${e.message}`); }
}

if (errors.length) {
  console.error(`Build checks failed (${errors.length}):\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(`Built _site/ (${files.length} files, ${jsFiles.length} modules) at v=${sha}`);
