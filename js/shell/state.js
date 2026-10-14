// Mutable shell session state plus the path helpers that read it.
// Exported as one object rather than loose `let`s so other modules can mutate it
// (ES module imports are read-only bindings).
//
// Paths are arrays of segments from the root: /home/dhairya is ['home','dhairya'].

import { VFS, HOME_PATH } from './vfs.js';

export { HOME_PATH };
export const HOME_DIR = '/' + HOME_PATH.join('/');

export const shell = {
  cwd: [...HOME_PATH],
  history: [],    // most recent command first
  histIdx: -1,    // cursor into history for ↑/↓
  status: 0,      // exit status of the last command ($?)
  startedAt: Date.now(),
  env: {
    HOME: HOME_DIR, USER: 'dhairya', LOGNAME: 'dhairya', SHELL: '/bin/zsh',
    PATH: '/bin:/usr/bin', PWD: HOME_DIR, OLDPWD: HOME_DIR, TERM: 'xterm-256color',
    HOSTNAME: 'nextcube', LANG: 'en_US.UTF-8', EDITOR: 'nano', PAGER: 'less',
  },
  aliases: { ll: 'ls -la', la: 'ls -a', l: 'ls -l', neofetch: 'fastfetch', '..': 'cd ..' },
  userVars: {},   // exported by the visitor (persisted)
  unaliased: [],  // built-in aliases the visitor removed (persisted)
};

// Walk the VFS to the node at `pathArr`, or null if any segment is missing.
export function getNode(pathArr) {
  let node = VFS;
  for (const seg of pathArr) {
    if (!node || node.type !== 'dir' || !Object.hasOwn(node.entries, seg)) return null;
    node = node.entries[seg];
  }
  return node;
}

export const absPath = (pathArr) => '/' + pathArr.join('/');

const underHome = (p) => HOME_PATH.every((s, i) => p[i] === s);

// /home/dhairya/x → ~/x; anything else stays absolute.
export function displayPath(pathArr) {
  if (underHome(pathArr)) {
    const rest = pathArr.slice(HOME_PATH.length);
    return rest.length ? '~/' + rest.join('/') : '~';
  }
  return absPath(pathArr);
}

export const formatCwd = () => displayPath(shell.cwd);

export function updatePromptLabel() {
  const el = typeof document !== 'undefined' && document.getElementById('shell-prompt');
  if (el) el.textContent = `dhairya@nextcube:${formatCwd()}$ `;
}

export function setCwd(pathArr) {
  shell.env.OLDPWD = absPath(shell.cwd);
  shell.cwd = pathArr;
  shell.env.PWD = absPath(pathArr);
  updatePromptLabel();
}

// Resolve a user-typed path against the cwd, normalising `.`, `..`, `~` and `/`.
export function resolvePath(arg) {
  if (arg === undefined || arg === '' || arg === '~') return [...HOME_PATH];
  if (arg === '-') return splitAbs(shell.env.OLDPWD || HOME_DIR);
  let segs;
  if (arg.startsWith('~/')) segs = [...HOME_PATH, ...arg.slice(2).split('/')];
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

const splitAbs = (s) => s.split('/').filter(Boolean);

// Only the home directory and /tmp are writable (and persisted).
export const isWritable = (p) => underHome(p) || p[0] === 'tmp';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// ls-style timestamp for files created in this session, e.g. "Oct 13 21:09".
export function stamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
