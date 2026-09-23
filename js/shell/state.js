// Mutable shell session state plus the path helpers that read it.
// Exported as one object rather than loose `let`s so other modules can mutate it
// (ES module imports are read-only bindings).

import { VFS } from './vfs.js';

const shellPromptEl = document.getElementById('shell-prompt');

export const shell = {
  cwd: [],        // path segments below /home/dhairya
  history: [],    // most recent command first
  histIdx: -1     // cursor into history for ↑/↓
};

// Walk the VFS to the node at `pathArr`, or null if any segment is missing.
export function getNode(pathArr) {
  let node = VFS;
  for (const seg of pathArr) {
    if (!node || node.type !== 'dir' || !node.entries[seg]) return null;
    node = node.entries[seg];
  }
  return node;
}

export function formatCwd() {
  return shell.cwd.length === 0 ? '~' : '~/' + shell.cwd.join('/');
}

export function updatePromptLabel() {
  shellPromptEl.textContent = `dhairya@nextcube:${formatCwd()}$\u00a0`;
}

export function setCwd(pathArr) {
  shell.cwd = pathArr;
  updatePromptLabel();
}

// Resolve a user-typed path against the cwd, normalising `.`, `..`, `~` and `/`.
export function resolvePath(arg) {
  if (!arg || arg === '~') return [];
  if (arg === '-') return shell.cwd.slice(0, -1); // crude cd -
  let segs;
  if (arg.startsWith('~/')) segs = arg.slice(2).split('/');
  else if (arg.startsWith('/')) segs = arg.slice(1).split('/');
  else segs = [...shell.cwd, ...arg.split('/')];
  const out = [];
  for (const s of segs) {
    if (!s || s === '.') continue;
    if (s === '..') { if (out.length) out.pop(); }
    else out.push(s);
  }
  return out;
}
