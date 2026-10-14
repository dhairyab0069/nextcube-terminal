// Tab completion: command names in command position (start of line, or
// after | ; && ||), file paths everywhere else. Completes the longest common
// prefix, and lists the candidates when that's ambiguous.

import { CMDS } from './commands/index.js';
import { getNode, resolvePath, shell } from './state.js';
import { w, esc, dirSpan, fileSpan, execSpan } from './output.js';

const lcp = (strs) => strs.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });

export function tabComplete(val) {
  const word = val.match(/[^\s|;&<>]*$/)[0];
  const before = val.slice(0, val.length - word.length);
  const cmdPos = /(^|\|\||&&|[|;&])\s*$/.test(before);
  let items;   // [{ text, label }]
  if (cmdPos && !word.includes('/')) {
    items = [...new Set([...Object.keys(CMDS), ...Object.keys(shell.aliases)])]
      .filter(c => c.startsWith(word)).sort()
      .map(c => ({ text: c + ' ', label: esc(c) }));
  } else {
    if (word.startsWith('$')) {
      const stem = word.slice(1).replace(/^\{/, '');
      items = Object.keys(shell.env).filter(k => k.startsWith(stem)).sort()
        .map(k => ({ text: (word.startsWith('${') ? '${' + k + '}' : '$' + k), label: esc(k) }));
    } else {
      const slash = word.lastIndexOf('/');
      const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
      const stem = word.slice(slash + 1);
      const node = getNode(resolvePath(dirPart || '.'));
      if (!node || node.type !== 'dir' || node.locked) return val;
      items = Object.keys(node.entries).sort()
        .filter(n => n.startsWith(stem) && (stem.startsWith('.') || !n.startsWith('.')))
        .map(n => {
          const e = node.entries[n];
          const isDir = e.type === 'dir';
          return { text: dirPart + n + (isDir ? '/' : ' '), label: isDir ? dirSpan(n) : e.exec ? execSpan(n) : fileSpan(n) };
        });
    }
  }
  if (!items.length) return val;
  if (items.length === 1) return before + items[0].text;
  const common = lcp(items.map(i => i.text.replace(/[ /]$/, (m) => m === '/' ? '/' : '')));
  if (common.length > word.length) return before + common;
  const cols = items.map(i => `<span style="display:inline-block;min-width:18ch">${i.label}</span>`);
  for (let k = 0; k < cols.length; k += 5) w(cols.slice(k, k + 5).join(''));
  return val;
}
