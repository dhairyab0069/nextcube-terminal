// Helpers shared by command modules: option parsing and text input.

import { wErr } from '../output.js';
import { readText } from '../fs.js';

// Short-option parser. getopt(args, { flags: 'la', valued: 'n' }) →
// { opts: { l: true, n: '5' }, rest: [...] }. Long options land in opts by
// name (--section=.flag → opts.section). `numeric` lets -5 through as an
// operand (head -5). Throws on unknown flags.
export function getopt(args, { flags = '', valued = '', numeric = false, long = true } = {}) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (long && a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      if (eq > 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else opts[a.slice(2)] = true;
      continue;
    }
    if (a.length > 1 && a[0] === '-' && !(numeric && /^-\d+$/.test(a))) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j];
        if (valued.includes(f)) {
          const v = a.slice(j + 1) || args[++i];
          if (v === undefined) throw new Error(`option requires an argument -- '${f}'`);
          opts[f] = v;
          break;
        }
        if (!flags.includes(f)) throw new Error(`invalid option -- '${f}'`);
        opts[f] = true;
      }
      continue;
    }
    rest.push(a);
  }
  return { opts, rest };
}

// Inputs for a filter command: each named file, or stdin when there are none
// (or for "-"). Missing files are reported and skipped.
export function inputs(files, ctx, name) {
  if (!files.length) return [{ name: '-', text: ctx.stdin ?? '' }];
  const out = [];
  for (const f of files) {
    if (f === '-') { out.push({ name: '-', text: ctx.stdin ?? '' }); continue; }
    try { out.push({ name: f, text: readText(f) }); }
    catch (e) { wErr(`${name}: ${f}: ${e.message}`); }
  }
  return out;
}

export const toLines = (t) => (t === '' ? [] : t.replace(/\n$/, '').split('\n'));
export const fromLines = (lines) => (lines.length ? lines.join('\n') + '\n' : '');

export function humanSize(n) {
  const units = ['B', 'K', 'M', 'G'];
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return u === 0 ? `${n}` : `${n < 10 ? n.toFixed(1) : Math.round(n)}${units[u]}`;
}

// Interpret backslash escapes (echo -e, printf).
export function unescape(s) {
  return s.replace(/\\(0[0-7]{0,3}|x[0-9a-fA-F]{1,2}|.)/g, (m, c) => {
    if (c[0] === '0' ) return String.fromCharCode(parseInt(c.slice(1) || '0', 8));
    if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', '\\': '\\', a: '', b: '\b', e: '\x1b', v: '\v', f: '\f' }[c] ?? m;
  });
}
