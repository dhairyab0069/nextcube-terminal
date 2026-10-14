// Filesystem operations on the VFS, shared by commands, redirects and the
// editor. Errors are thrown as FsError with the libc-style message
// ("No such file or directory"); callers prefix them with the command name.

import { getNode, resolvePath, isWritable, stamp, displayPath, shell } from './state.js';
import { saveFs } from './storage.js';
import { globToRegExp, hasGlob } from './parse.js';
import { VFS } from './vfs.js';

export class FsError extends Error {}

export function lookup(arg) {
  const path = resolvePath(arg);
  return { path, node: getNode(path) };
}

export function readText(arg) {
  const { node } = lookup(arg);
  if (!node) throw new FsError('No such file or directory');
  if (node.type === 'dir') throw new FsError('Is a directory');
  return node.content ?? '';
}

function parentDir(path) {
  const parent = getNode(path.slice(0, -1));
  if (!parent) throw new FsError('No such file or directory');
  if (parent.type !== 'dir') throw new FsError('Not a directory');
  if (parent.locked) throw new FsError('Permission denied');
  return parent;
}

function checkWritable(path) {
  if (!isWritable(path) || !path.length) throw new FsError('Permission denied');
}

const touchDir = (dir) => { dir.modified = stamp(); };

export function writeFile(path, content, append = false) {
  if (path[0] === 'dev' && path[1] === 'null' && path.length === 2) return;
  const parent = parentDir(path);
  checkWritable(path);
  const name = path[path.length - 1];
  const existing = parent.entries[name];
  if (existing?.type === 'dir') throw new FsError('Is a directory');
  const text = append && existing ? (existing.content ?? '') + content : content;
  parent.entries[name] = {
    type: 'file', size: text.length, modified: stamp(), content: text,
    ...(name.startsWith('.') ? { hidden: true } : {}),
    ...(existing?.exec ? { exec: true } : {}),
  };
  touchDir(parent);
  saveFs();
}

// Update a node's timestamp (touch) or flags (chmod) in place.
export function updateNode(path, fn = () => {}) {
  const node = getNode(path);
  if (!node) throw new FsError('No such file or directory');
  checkWritable(path);
  fn(node);
  node.modified = stamp();
  saveFs();
}

export function makeDir(path, parents = false) {
  if (parents) {
    for (let k = 1; k <= path.length; k++) {
      const node = getNode(path.slice(0, k));
      if (node?.type === 'dir') continue;
      if (node) throw new FsError('File exists');
      makeDir(path.slice(0, k));
    }
    return;
  }
  const parent = parentDir(path);
  checkWritable(path);
  const name = path[path.length - 1];
  if (parent.entries[name]) throw new FsError('File exists');
  parent.entries[name] = { type: 'dir', modified: stamp(), entries: {}, ...(name.startsWith('.') ? { hidden: true } : {}) };
  touchDir(parent);
  saveFs();
}

export function removeNode(path) {
  const parent = parentDir(path);
  checkWritable(path);
  delete parent.entries[path[path.length - 1]];
  touchDir(parent);
  saveFs();
}

export const clone = (node) => JSON.parse(JSON.stringify(node));

export function putNode(path, node) {
  const parent = parentDir(path);
  checkWritable(path);
  const name = path[path.length - 1];
  node.hidden = name.startsWith('.') || undefined;
  parent.entries[name] = node;
  touchDir(parent);
  saveFs();
}

export const isAncestor = (a, b) => a.length <= b.length && a.every((s, i) => b[i] === s);

// Depth-first walk: fn(path, node, depth) for the node and everything below.
export function walk(path, node, fn, depth = 0) {
  if (fn(path, node, depth) === false) return;
  if (node.type === 'dir' && !node.locked) {
    for (const name of Object.keys(node.entries).sort()) walk([...path, name], node.entries[name], fn, depth + 1);
  }
}

export function treeSize(node) {
  if (node.type !== 'dir') return node.size ?? (node.content || '').length;
  return 4096 + Object.values(node.entries).reduce((n, e) => n + treeSize(e), 0);
}

// Expand a glob pattern (possibly with / segments) against the VFS. Returns
// paths spelled the way the user typed them, sorted; [] if nothing matched.
export function glob(pattern) {
  const absolute = pattern.startsWith('/');
  const segs = pattern.split('/').filter((s, i) => s !== '' || i === 0);
  let results = [{ path: absolute ? [] : [...shell.cwd], text: absolute ? '' : null }];
  for (const seg of absolute ? segs.slice(1) : segs) {
    const next = [];
    for (const r of results) {
      const node = getNode(r.path);
      if (!node || node.type !== 'dir' || node.locked) continue;
      const join = (name) => r.text === null ? name : r.text + '/' + name;
      if (!hasGlob(seg)) {
        const lit = seg.replace(/\\(.)/g, '$1');
        if (lit === '.' || lit === '..') { next.push({ path: resolvePath(absPathOf(r.path) + '/' + lit), text: join(lit) }); continue; }
        if (Object.hasOwn(node.entries, lit)) next.push({ path: [...r.path, lit], text: join(lit) });
        continue;
      }
      const re = globToRegExp(seg);
      for (const name of Object.keys(node.entries).sort()) {
        if (name.startsWith('.') && !seg.startsWith('.')) continue;
        if (re.test(name)) next.push({ path: [...r.path, name], text: join(name) });
      }
    }
    results = next;
  }
  return results.map(r => r.text ?? '.').map(t => absolute ? t || '/' : t);
}

const absPathOf = (p) => '/' + p.join('/');

export { displayPath, VFS };
