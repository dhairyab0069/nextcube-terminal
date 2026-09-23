// Tab completion: command names on the first word, filenames after that.
// Filenames complete relative to any directory part of the word being typed,
// so `cat research/ca<Tab>` works as well as `cat ab<Tab>`.

import { CMDS } from './commands/index.js';
import { getNode, resolvePath } from './state.js';
import { w } from './output.js';

export function tabComplete(val) {
  const parts = val.split(' ');
  const last = parts[parts.length - 1];
  if (parts.length === 1) {
    const matches = Object.keys(CMDS).filter(c => c.startsWith(last));
    if (matches.length === 1) return matches[0] + ' ';
    if (matches.length > 1) w(matches.join('  '));
    return val;
  }
  const slash = last.lastIndexOf('/');
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
  const stem = last.slice(slash + 1);
  const node = getNode(resolvePath(dirPart || '.'));
  if (node && node.type === 'dir') {
    const matches = Object.entries(node.entries)
      .filter(([n]) => n.startsWith(stem));
    if (matches.length === 1) {
      const [n, e] = matches[0];
      return [...parts.slice(0,-1), dirPart + n + (e.type==='dir' ? '/' : '')].join(' ');
    }
    if (matches.length > 1) w(matches.map(([n,e]) => n+(e.type==='dir'?'/':'')).join('  '));
  }
  return val;
}
