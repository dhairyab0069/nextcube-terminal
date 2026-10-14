// Text tools that read files or stdin and write plain text, so they compose
// in pipelines: echo, printf, grep, head, tail, wc, sort, uniq, cut, tr, sed,
// awk, rev, tac, nl, tee, seq, base64, xargs, diff, less/more.

import { w, wErr, print, esc, capturing } from '../output.js';
import { getNode, resolvePath } from '../state.js';
import { writeFile, walk } from '../fs.js';
import { runSed, runAwk, sprintf } from '../textproc.js';
import { runCommand } from '../exec.js';
import { getopt, inputs, toLines, fromLines, unescape } from './util.js';

const out = (lines) => print(fromLines(lines));

function headTail(which) {
  return (args, ctx) => {
    let n = 10, fromStart = false;
    const files = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-n') { const v = args[++i] ?? ''; fromStart = v.startsWith('+'); n = parseInt(v, 10); }
      else if (/^-n[+\d]/.test(a)) { fromStart = a[2] === '+'; n = parseInt(a.slice(2), 10); }
      else if (/^-\d+$/.test(a)) n = Number(a.slice(1));
      else if (a.startsWith('-') && a !== '-') { wErr(`${which}: illegal option -- ${a.slice(1)}`); return 1; }
      else files.push(a);
    }
    if (Number.isNaN(n)) { wErr(`${which}: illegal line count`); return 1; }
    n = Math.abs(n);
    const ins = inputs(files, ctx, which);
    ins.forEach((input, k) => {
      if (ins.length > 1) { if (k) print('\n'); print(`==> ${input.name} <==\n`); }
      const lines = toLines(input.text);
      out(which === 'head' ? lines.slice(0, n) : fromStart ? lines.slice(Math.max(0, n - 1)) : lines.slice(Math.max(0, lines.length - n)));
    });
    return ins.length < (files.length || 1) ? 1 : 0;
  };
}

function view(args, ctx) {
  const files = args.filter(a => !a.startsWith('-'));
  if (!files.length && ctx.stdin === null) { wErr('Missing filename ("less --help" for help)'); return 1; }
  const ins = inputs(files, ctx, 'less');
  ins.forEach(i => print(i.text.endsWith('\n') || !i.text ? i.text : i.text + '\n'));
  return ins.length < (files.length || 1) ? 1 : 0;
}

// tr sets: ranges a-z, classes [:upper:] etc., escapes.
function expandSet(set) {
  set = unescape(set)
    .replace(/\[:upper:\]/g, 'A-Z').replace(/\[:lower:\]/g, 'a-z').replace(/\[:digit:\]/g, '0-9')
    .replace(/\[:alpha:\]/g, 'a-zA-Z').replace(/\[:alnum:\]/g, 'a-zA-Z0-9').replace(/\[:space:\]/g, ' \t\n\r\v\f')
    .replace(/\[:punct:\]/g, '!-/:-@[-`{-~');
  const chars = [];
  for (let i = 0; i < set.length; i++) {
    if (set[i + 1] === '-' && i + 2 < set.length) {
      for (let c = set.charCodeAt(i); c <= set.charCodeAt(i + 2); c++) chars.push(String.fromCharCode(c));
      i += 2;
    } else chars.push(set[i]);
  }
  return chars;
}

// cut -f / -c lists: "1,3", "2-4", "-2", "3-".
function parseList(spec) {
  return spec.split(',').map(part => {
    const m = part.match(/^(\d*)(-?)(\d*)$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`[-cf] list: illegal list value`);
    const a = m[1] ? Number(m[1]) : 1;
    const b = m[2] ? (m[3] ? Number(m[3]) : Infinity) : a;
    return [a, b];
  });
}
const inList = (ranges, n) => ranges.some(([a, b]) => n >= a && n <= b);

export const textCommands = {
  // zsh's echo interprets backslash escapes by default; -E turns that off.
  echo(args) {
    let newline = true, escapes = true, i = 0;
    for (; i < args.length && /^-[neE]+$/.test(args[i]); i++) {
      if (args[i].includes('n')) newline = false;
      if (args[i].includes('e')) escapes = true;
      if (args[i].includes('E')) escapes = false;
    }
    let text = args.slice(i).join(' ');
    if (escapes) text = unescape(text);
    print(text + (newline ? '\n' : ''));
  },

  printf(args) {
    if (!args.length) { wErr('usage: printf format [arguments ...]'); return 1; }
    const fmt = unescape(args[0]);
    const rest = args.slice(1);
    const convs = (fmt.match(/%[-+ 0#]*\d*(?:\.\d+)?[sdifxXoce]/g) || []).length;
    let s = '';
    if (!convs) s = fmt;
    else for (let k = 0; k < Math.max(1, rest.length); k += convs) s += sprintf(fmt, rest.slice(k, k + convs));
    print(s);
  },

  grep(args, ctx) {
    let opts, rest;
    try { ({ opts, rest } = getopt(args, { flags: 'ivnclLroEFwhHqsRx', valued: 'e' })); }
    catch (e) { wErr(`grep: ${e.message}`); wErr('usage: grep [-ivnclroEFwhq] [-e pattern] [pattern] [file ...]'); return 2; }
    let pattern = opts.e;
    if (pattern === undefined) {
      if (!rest.length) { wErr('usage: grep [-ivnclroEFwhq] [-e pattern] [pattern] [file ...]'); return 2; }
      pattern = rest.shift();
    }
    const recursive = opts.r || opts.R;
    let src = opts.F ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : opts.E ? pattern : pattern.replace(/\\([(){}|+?])/g, '$1');
    if (opts.w) src = `\\b(?:${src})\\b`;
    if (opts.x) src = `^(?:${src})$`;
    let re;
    try { re = new RegExp(src, opts.i ? 'gi' : 'g'); }
    catch { wErr(`grep: invalid regular expression: ${pattern}`); return 2; }
    let files = rest;
    if (recursive) {
      files = [];
      for (const start of rest.length ? rest : ['.']) {
        const root = resolvePath(start);
        const node = getNode(root);
        if (!node) { if (!opts.s) wErr(`grep: ${start}: No such file or directory`); continue; }
        walk(root, node, (p, n) => {
          if (n.type !== 'file') return;
          const rel = p.slice(root.length).join('/');
          files.push(rel ? (start === '.' ? rel : `${start.replace(/\/$/, '')}/${rel}`) : start);
        });
      }
      if (!files.length) return 1;
    } else {
      for (const f of files) {
        if (getNode(resolvePath(f))?.type === 'dir') { if (!opts.s) wErr(`grep: ${f}: Is a directory`); }
      }
      files = files.filter(f => getNode(resolvePath(f))?.type !== 'dir');
      if (rest.length && !files.length) return 2;
    }
    const ins = inputs(files, ctx, 'grep');
    const showName = !opts.h && (opts.H || ins.length > 1 || recursive);
    const color = !capturing();
    let matched = false;
    for (const { name, text } of ins) {
      let count = 0;
      const lines = toLines(text);
      for (let n = 0; n < lines.length; n++) {
        const line = lines[n];
        re.lastIndex = 0;
        const hit = re.test(line);
        if (hit === !!opts.v) continue;
        count++; matched = true;
        if (opts.q) return 0;
        if (opts.c || opts.l || opts.L) continue;
        const prefix = (showName ? name + ':' : '') + (opts.n ? (n + 1) + ':' : '');
        if (opts.o && !opts.v) {
          re.lastIndex = 0;
          for (const m of line.matchAll(re)) if (m[0]) emitLine(prefix, m[0], color, null);
        } else emitLine(prefix, line, color, opts.v ? null : re);
      }
      if (opts.c) print(`${showName ? name + ':' : ''}${count}\n`);
      if (opts.l && count) print(`${name === '-' ? '(standard input)' : name}\n`);
      if (opts.L && !count) print(`${name}\n`);
    }
    return matched ? 0 : 1;
  },

  head: headTail('head'),
  tail: headTail('tail'),

  wc(args, ctx) {
    let opts, rest;
    try { ({ opts, rest } = getopt(args, { flags: 'lwcm' })); } catch (e) { wErr(`wc: ${e.message}`); return 1; }
    const pick = (opts.l || opts.w || opts.c || opts.m) ? opts : { l: true, w: true, c: true };
    const ins = inputs(rest, ctx, 'wc');
    const tot = [0, 0, 0];
    const row = (counts, name) => {
      const cols = [];
      if (pick.l) cols.push(counts[0]);
      if (pick.w) cols.push(counts[1]);
      if (pick.c || pick.m) cols.push(counts[2]);
      print(cols.map(c => String(c).padStart(rest.length || cols.length > 1 ? 8 : 0)).join('') + (name !== '-' ? ' ' + name : '') + '\n');
    };
    for (const { name, text } of ins) {
      const c = [(text.match(/\n/g) || []).length, (text.match(/\S+/g) || []).length, new TextEncoder().encode(text).length];
      c.forEach((v, i) => { tot[i] += v; });
      row(c, name);
    }
    if (ins.length > 1) row(tot, 'total');
    return ins.length < (rest.length || 1) ? 1 : 0;
  },

  sort(args, ctx) {
    let opts, rest;
    try { ({ opts, rest } = getopt(args, { flags: 'rnufbV', valued: 'kto' })); } catch (e) { wErr(`sort: ${e.message}`); return 2; }
    const lines = inputs(rest, ctx, 'sort').flatMap(i => toLines(i.text));
    const k = opts.k ? parseInt(opts.k, 10) : 0;
    const keyOf = (l) => {
      if (!k) return opts.b ? l.trim() : l;
      const parts = opts.t ? l.split(opts.t) : l.trim().split(/\s+/);
      return parts.slice(k - 1).join(opts.t || ' ');
    };
    const cmp = opts.n
      ? (a, b) => (parseFloat(keyOf(a)) || 0) - (parseFloat(keyOf(b)) || 0)
      : opts.V
        ? (a, b) => keyOf(a).localeCompare(keyOf(b), undefined, { numeric: true })
        : opts.f
          ? (a, b) => keyOf(a).toLowerCase() < keyOf(b).toLowerCase() ? -1 : keyOf(a).toLowerCase() > keyOf(b).toLowerCase() ? 1 : 0
          : (a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0;
    let sorted = lines.slice().sort(cmp);
    if (opts.r) sorted.reverse();
    if (opts.u) sorted = sorted.filter((l, i) => i === 0 || cmp(l, sorted[i - 1]) !== 0);
    if (opts.o) { try { writeFile(resolvePath(opts.o), fromLines(sorted)); } catch (e) { wErr(`sort: ${opts.o}: ${e.message}`); return 2; } return 0; }
    out(sorted);
  },

  uniq(args, ctx) {
    let opts, rest;
    try { ({ opts, rest } = getopt(args, { flags: 'cdui' })); } catch (e) { wErr(`uniq: ${e.message}`); return 1; }
    const lines = inputs(rest.slice(0, 1), ctx, 'uniq').flatMap(i => toLines(i.text));
    const groups = [];
    const same = (a, b) => opts.i ? a.toLowerCase() === b.toLowerCase() : a === b;
    for (const l of lines) {
      const g = groups[groups.length - 1];
      if (g && same(g.line, l)) g.n++;
      else groups.push({ line: l, n: 1 });
    }
    const kept = groups.filter(g => (!opts.d || g.n > 1) && (!opts.u || g.n === 1));
    const result = fromLines(kept.map(g => opts.c ? `${String(g.n).padStart(4)} ${g.line}` : g.line));
    if (rest[1]) { try { writeFile(resolvePath(rest[1]), result); } catch (e) { wErr(`uniq: ${rest[1]}: ${e.message}`); return 1; } }
    else print(result);
  },

  cut(args, ctx) {
    let opts, rest;
    try { ({ opts, rest } = getopt(args, { flags: 's', valued: 'dfcb' })); } catch (e) { wErr(`cut: ${e.message}`); return 1; }
    if (!opts.f && !opts.c && !opts.b) { wErr('usage: cut -b list [-n] [file ...]\n       cut -c list [file ...]\n       cut -f list [-s] [-d delim] [file ...]'); return 1; }
    let ranges;
    try { ranges = parseList(opts.f || opts.c || opts.b); } catch (e) { wErr(`cut: ${e.message}`); return 1; }
    const delim = opts.d ?? '\t';
    const lines = inputs(rest, ctx, 'cut').flatMap(i => toLines(i.text));
    const res = [];
    for (const l of lines) {
      if (opts.f) {
        if (!l.includes(delim)) { if (!opts.s) res.push(l); continue; }
        res.push(l.split(delim).filter((_, i) => inList(ranges, i + 1)).join(delim));
      } else res.push([...l].filter((_, i) => inList(ranges, i + 1)).join(''));
    }
    out(res);
  },

  tr(args, ctx) {
    let opts, rest;
    try { ({ opts, rest } = getopt(args, { flags: 'dsc' })); } catch (e) { wErr(`tr: ${e.message}`); return 1; }
    if (!rest.length || (!opts.d && !opts.s && rest.length < 2)) { wErr('usage: tr [-cds] string1 [string2]'); return 1; }
    const text = ctx.stdin ?? '';
    const a = expandSet(rest[0]);
    let res = '';
    if (opts.d) {
      const set = new Set(a);
      res = [...text].filter(c => opts.c ? set.has(c) : !set.has(c)).join('');
    } else if (rest[1] !== undefined) {
      const b = expandSet(rest[1]);
      const map = new Map(a.map((c, i) => [c, b[Math.min(i, b.length - 1)] ?? '']));
      res = [...text].map(c => map.has(c) ? map.get(c) : c).join('');
    } else res = text;
    if (opts.s) {
      const squeeze = new Set(rest[1] !== undefined && !opts.d ? expandSet(rest[1]) : a);
      res = res.replace(/(.)\1+/gs, (m, c) => squeeze.has(c) ? c : m);
    }
    print(res);
  },

  sed(args, ctx) {
    const scripts = [];
    const files = [];
    let quiet = false, inPlace = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-n') quiet = true;
      else if (a === '-e') scripts.push(args[++i] ?? '');
      else if (a === '-i' || a === '-E' || a === '-r') { if (a === '-i') inPlace = true; }
      else if (!scripts.length && !a.startsWith('-')) scripts.push(a);
      else files.push(a);
    }
    if (!scripts.length) { wErr('usage: sed [-n] [-i] [-e script] script [file ...]'); return 1; }
    try {
      if (inPlace) {
        for (const f of files) writeFile(resolvePath(f), runSed(scripts, inputs([f], ctx, 'sed')[0]?.text ?? '', { quiet }));
        return 0;
      }
      const text = inputs(files, ctx, 'sed').map(i => i.text.endsWith('\n') || !i.text ? i.text : i.text + '\n').join('');
      print(runSed(scripts, text, { quiet }));
    } catch (e) { wErr(`sed: ${e.message}`); return 1; }
  },

  awk(args, ctx) {
    let fs = null;
    const vars = {};
    const rest = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-F') fs = unescape(args[++i] ?? ' ');
      else if (a.startsWith('-F')) fs = unescape(a.slice(2));
      else if (a === '-v') { const [k, ...v] = (args[++i] ?? '').split('='); vars[k] = v.join('='); }
      else rest.push(a);
    }
    if (!rest.length) { wErr("usage: awk [-F fs][-v var=value][prog | -f progfile][file ...]"); return 2; }
    const [program, ...files] = rest;
    try { print(runAwk(program, inputs(files, ctx, 'awk'), { fs, vars })); }
    catch (e) { wErr(`awk: ${e.message}`); return 2; }
  },

  rev(args, ctx) {
    out(inputs(args, ctx, 'rev').flatMap(i => toLines(i.text)).map(l => [...l].reverse().join('')));
  },

  tac(args, ctx) {
    out(inputs(args, ctx, 'tac').flatMap(i => toLines(i.text)).reverse());
  },

  nl(args, ctx) {
    let n = 0;
    out(inputs(args.filter(a => !a.startsWith('-')), ctx, 'nl').flatMap(i => toLines(i.text))
      .map(l => l.trim() ? `${String(++n).padStart(6)}\t${l}` : l));
  },

  tee(args, ctx) {
    const { opts, rest } = getopt(args, { flags: 'a' });
    const text = ctx.stdin ?? '';
    let status = 0;
    for (const f of rest) {
      try { writeFile(resolvePath(f), text, !!opts.a); }
      catch (e) { wErr(`tee: ${f}: ${e.message}`); status = 1; }
    }
    print(text);
    return status;
  },

  seq(args) {
    const nums = args.filter(a => !/^-[a-z]/.test(a)).map(Number);
    if (!nums.length || nums.some(Number.isNaN)) { wErr('usage: seq [-w] [-f format] [-s string] [-t string] [first [incr]] last'); return 1; }
    const [first, step, last] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
    if (step === 0) { wErr('seq: zero increment'); return 1; }
    const res = [];
    for (let x = first; step > 0 ? x <= last : x >= last; x += step) {
      res.push(String(Number(x.toFixed(10))));
      if (res.length > 10000) { wErr('seq: output capped at 10000 lines'); break; }
    }
    out(res);
  },

  base64(args, ctx) {
    const { opts, rest } = getopt(args, { flags: 'dDi', long: true });
    const text = inputs(rest, ctx, 'base64').map(i => i.text).join('');
    try {
      if (opts.d || opts.D || opts.decode) {
        const bytes = Uint8Array.from(atob(text.replace(/\s+/g, '')), c => c.charCodeAt(0));
        print(new TextDecoder().decode(bytes));
      } else {
        const bin = Array.from(new TextEncoder().encode(text), b => String.fromCharCode(b)).join('');
        print(btoa(bin).replace(/.{76}/g, '$&\n') + '\n');
      }
    } catch { wErr('base64: invalid input'); return 1; }
  },

  xargs(args, ctx) {
    let n = Infinity;
    const cmd = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n') n = Number(args[++i]) || Infinity;
      else if (/^-n\d+$/.test(args[i])) n = Number(args[i].slice(2));
      else { cmd.push(...args.slice(i)); break; }
    }
    if (!cmd.length) cmd.push('echo');
    const items = (ctx.stdin ?? '').match(/"[^"]*"|'[^']*'|\S+/g)?.map(s => s.replace(/^(["'])(.*)\1$/, '$2')) ?? [];
    if (!items.length) return runCommand(cmd);
    let status = 0;
    for (let i = 0; i < items.length; i += n === Infinity ? items.length : n) {
      const st = runCommand([...cmd, ...items.slice(i, n === Infinity ? undefined : i + n)]);
      if (st) status = st > 125 ? st : 123;
    }
    return status;
  },

  diff(args) {
    const files = args.filter(a => !a.startsWith('-'));
    if (files.length !== 2) { wErr('usage: diff file1 file2'); return 2; }
    const texts = [];
    for (const f of files) {
      const node = getNode(resolvePath(f));
      if (!node) { wErr(`diff: ${f}: No such file or directory`); return 2; }
      if (node.type === 'dir') { wErr(`diff: ${f}: Is a directory`); return 2; }
      texts.push(toLines(node.content ?? ''));
    }
    const [a, b] = texts;
    if (a.length * b.length > 4e6) { wErr('diff: files too large'); return 2; }
    // LCS table, then walk it to emit ed-style hunks.
    const L = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const hunks = [];
    let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; continue; }
      const h = { i, j, del: [], add: [] };
      while ((i < a.length || j < b.length) && !(i < a.length && j < b.length && a[i] === b[j])) {
        if (j < b.length && (i >= a.length || L[i][j + 1] >= L[i + 1][j])) h.add.push(b[j++]);
        else h.del.push(a[i++]);
      }
      hunks.push(h);
    }
    if (!hunks.length) return 0;
    const range = (s, n) => n <= 1 ? String(s + (n ? 1 : 0)) : `${s + 1},${s + n}`;
    const color = !capturing();
    for (const h of hunks) {
      const tag = h.del.length && h.add.length ? 'c' : h.del.length ? 'd' : 'a';
      const left = tag === 'a' ? String(h.i) : range(h.i, h.del.length);
      const right = tag === 'd' ? String(h.j) : range(h.j, h.add.length);
      w(`<span style="color:var(--color-primary)">${left}${tag}${right}</span>`);
      h.del.forEach(l => w(color ? `<span style="color:var(--color-magenta)">&lt; ${esc(l)}</span>` : `< ${esc(l)}`));
      if (tag === 'c') w('---');
      h.add.forEach(l => w(color ? `<span style="color:var(--color-green)">&gt; ${esc(l)}</span>` : `> ${esc(l)}`));
    }
    return 1;
  },

  less: view,
  more: view,
};

function emitLine(prefix, line, color, re) {
  if (!color || !re) { print(prefix + line + '\n'); return; }
  re.lastIndex = 0;
  const marked = line.replace(re, (m) => `\u0000${m}\u0001`);
  const body = esc(marked).replace(/\u0000/g, '<span style="color:var(--color-gold);font-weight:600">').replace(/\u0001/g, '</span>');
  w(`<span style="color:var(--color-primary)">${esc(prefix)}</span><span style="white-space:pre">${body}</span>`);
}
