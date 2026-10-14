// Persists what visitors change (the home directory, /tmp, aliases, exported
// variables and command history) to localStorage. The saved home directory is
// tagged with a hash of the shipped one, so a deploy that changes the
// built-in files discards stale copies instead of hiding the update.

import { VFS, HOME } from './vfs.js';

const FS_KEY = 'nextcube_fs';
const SHELL_KEY = 'nextcube_shell';

// ~/publications is fetched at startup, so it's never saved.
const strip = (home) => {
  const { publications, ...entries } = home.entries;
  return { ...home, entries };
};

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

let base = null;
let pristine = null;
let timer = null;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export function loadFs() {
  const shipped = JSON.stringify(strip(HOME));
  base = hash(shipped);
  pristine = { home: shipped, tmp: JSON.stringify(VFS.entries.tmp) };
  const saved = store.get(FS_KEY);
  if (saved && saved.base === base && saved.home?.entries) {
    HOME.entries = { ...saved.home.entries, ...(HOME.entries.publications ? { publications: HOME.entries.publications } : {}) };
    HOME.modified = saved.home.modified || HOME.modified;
    if (saved.tmp?.entries) VFS.entries.tmp = saved.tmp;
  }
}

export function saveFs() {
  if (base === null) return;   // not loaded (tests)
  clearTimeout(timer);
  timer = setTimeout(() => store.set(FS_KEY, { base, home: strip(HOME), tmp: VFS.entries.tmp }), 150);
}

// Put the home directory and /tmp back the way they shipped.
export function resetFs() {
  clearTimeout(timer);
  store.del(FS_KEY);
  const pubs = HOME.entries.publications;
  const fresh = JSON.parse(pristine.home);
  HOME.entries = { ...fresh.entries, ...(pubs ? { publications: pubs } : {}) };
  HOME.modified = fresh.modified;
  VFS.entries.tmp = JSON.parse(pristine.tmp);
}

export function loadShellPrefs(shell) {
  const saved = store.get(SHELL_KEY);
  if (!saved) return;
  if (Array.isArray(saved.history)) shell.history = saved.history.filter(h => typeof h === 'string').slice(0, 500);
  if (saved.aliases && typeof saved.aliases === 'object') Object.assign(shell.aliases, saved.aliases);
  if (saved.vars && typeof saved.vars === 'object') { Object.assign(shell.env, saved.vars); Object.assign(shell.userVars, saved.vars); }
  if (Array.isArray(saved.unaliased)) { shell.unaliased = saved.unaliased; saved.unaliased.forEach(a => delete shell.aliases[a]); }
}

// shell.userVars are the variables the visitor exported; built-ins like PWD aren't saved.
export function saveShellPrefs(shell) {
  store.set(SHELL_KEY, { history: shell.history.slice(0, 500), aliases: shell.aliases, vars: shell.userVars, unaliased: shell.unaliased });
}

export function resetShellPrefs() { store.del(SHELL_KEY); }
