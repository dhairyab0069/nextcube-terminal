// Shell grammar, DOM-free so it can be tested under node.
//
//   tokenize(line)        → raw words (quotes kept) and operators
//   parse(tokens)         → [{ connector, pipeline: [{ words, redirs }] }]
//   expandWord(raw, ctx)  → string[] after quotes, $VAR, ${VAR}, $?, $(...),
//                           $((...)), ~ and globs
//   arith(expr, vars)     → number, for $((...)), expr and bc
//
// Expansion is per command at run time (not at parse time), so
// `cd x && echo $PWD` and `export A=1; echo $A` behave like a real shell.

const OPS = ['2>&1', '2>>', '&&', '||', '>>', '2>', '|', ';', '>', '<', '&'];
const REDIRS = new Set(['>', '>>', '<', '2>', '2>>']);

export class ShellSyntaxError extends Error {}

// Index just past the `)` that closes the `(` at src[i - 1], skipping quotes.
function skipParens(src, i) {
  let depth = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { const j = src.indexOf("'", i + 1); if (j < 0) break; i = j + 1; continue; }
    if (c === '"') { i++; while (i < src.length && src[i] !== '"') i += src[i] === '\\' ? 2 : 1; i++; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
    i++;
  }
  throw new ShellSyntaxError("unexpected EOF while looking for matching `)'");
}

export function tokenize(src) {
  const out = [];
  let cur = null;
  const push = () => { if (cur !== null) { out.push({ t: 'word', v: cur }); cur = null; } };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { push(); i++; continue; }
    if (c === '#' && cur === null) break;
    const op = OPS.find(o => src.startsWith(o, i));
    // `2>` only counts at the start of a word (file2>x is "file2" then ">").
    if (op && !(op[0] === '2' && cur !== null)) { push(); out.push({ t: 'op', v: op }); i += op.length; continue; }
    if (c === '\\') { cur = (cur ?? '') + src.slice(i, i + 2); i += 2; continue; }
    if (c === "'") {
      const j = src.indexOf("'", i + 1);
      if (j < 0) throw new ShellSyntaxError("unexpected EOF while looking for matching `''");
      cur = (cur ?? '') + src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\') j += 2;
        else if (src.startsWith('$(', j)) j = skipParens(src, j + 2);
        else j++;
      }
      if (j >= src.length) throw new ShellSyntaxError('unexpected EOF while looking for matching `"\'');
      cur = (cur ?? '') + src.slice(i, j + 1); i = j + 1; continue;
    }
    if (src.startsWith('$(', i)) { const j = skipParens(src, i + 2); cur = (cur ?? '') + src.slice(i, j); i = j; continue; }
    cur = (cur ?? '') + c; i++;
  }
  push();
  return out;
}

const syntax = (tok) => new ShellSyntaxError(`syntax error near unexpected token \`${tok}'`);

export function parse(tokens) {
  const list = [];
  let pipeline = [];
  let cmd = { words: [], redirs: [] };
  let connector = null;
  const cmdEmpty = () => !cmd.words.length && !cmd.redirs.length;
  for (let k = 0; k < tokens.length; k++) {
    const tk = tokens[k];
    if (tk.t === 'word') { cmd.words.push(tk.v); continue; }
    if (REDIRS.has(tk.v)) {
      const target = tokens[++k];
      if (!target || target.t !== 'word') throw syntax(target ? target.v : 'newline');
      cmd.redirs.push({ op: tk.v, target: target.v });
      continue;
    }
    if (tk.v === '2>&1') { cmd.redirs.push({ op: '2>&1' }); continue; }
    if (cmdEmpty()) throw syntax(tk.v);
    pipeline.push(cmd);
    cmd = { words: [], redirs: [] };
    if (tk.v === '|') continue;
    list.push({ connector, pipeline });
    pipeline = [];
    connector = tk.v === '&' ? ';' : tk.v;
  }
  if (!cmdEmpty()) pipeline.push(cmd);
  else if (pipeline.length) throw syntax('|');
  if (pipeline.length) list.push({ connector, pipeline });
  else if (connector === '&&' || connector === '||') throw syntax(connector);
  return list;
}

// ── expansion ──

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*/;

// Expand a `$...` at src[i]. Returns [text, nextIndex].
function expandDollar(src, i, ctx) {
  if (src.startsWith('$((', i)) {
    const j = skipParens(src, i + 3);           // closes the inner (
    if (src[j] !== ')') throw new ShellSyntaxError('bad arithmetic expression');
    const expr = expandVarsOnly(src.slice(i + 3, j - 1), ctx);
    return [String(arith(expr, ctx.env)), j + 1];
  }
  if (src.startsWith('$(', i)) {
    const j = skipParens(src, i + 2);
    return [ctx.subst(src.slice(i + 2, j - 1)).replace(/\n+$/, ''), j];
  }
  if (src[i + 1] === '{') {
    const j = src.indexOf('}', i + 2);
    if (j < 0) throw new ShellSyntaxError('bad substitution');
    const inner = src.slice(i + 2, j);
    if (inner.startsWith('#')) return [String((ctx.env[inner.slice(1)] ?? '').length), j + 1];
    const m = inner.match(/^([A-Za-z_][A-Za-z0-9_]*)(?::-(.*))?$/);
    if (!m) throw new ShellSyntaxError(`\${${inner}}: bad substitution`);
    const val = ctx.env[m[1]];
    return [val === undefined || val === '' ? (m[2] ?? '') : val, j + 1];
  }
  const nx = src[i + 1];
  if (nx === '?') return [String(ctx.status ?? 0), i + 2];
  if (nx === '$') return ['501', i + 2];
  if (nx === '0') return ['zsh', i + 2];
  if (nx === '#') return [String((ctx.args || []).length), i + 2];
  if (nx === '@' || nx === '*') return [(ctx.args || []).join(' '), i + 2];
  if (nx >= '1' && nx <= '9') return [(ctx.args || [])[nx - 1] ?? '', i + 2];
  const m = src.slice(i + 1).match(NAME_RE);
  if (m) return [ctx.env[m[0]] ?? '', i + 1 + m[0].length];
  return ['$', i + 1];
}

function expandVarsOnly(src, ctx) {
  let out = '';
  for (let i = 0; i < src.length;) {
    if (src[i] === '$') { const [v, n] = expandDollar(src, i, ctx); out += v; i = n; }
    else out += src[i++];
  }
  return out;
}

// Returns the list of fields one raw word expands to.
export function expandWord(raw, ctx) {
  const fields = [];
  let cur = null;           // { v, glob, pat }  pat = glob pattern with quoted metachars escaped
  const add = (s, globbable) => {
    cur ??= { v: '', glob: false, pat: '' };
    cur.v += s;
    cur.pat += globbable ? s : s.replace(/[*?[\]\\]/g, '\\$&');
    if (globbable && /[*?[]/.test(s)) cur.glob = true;
  };
  const end = () => { if (cur) fields.push(cur); cur = null; };
  let i = 0;
  if (raw === '~' || raw.startsWith('~/')) { add(ctx.env.HOME || '/home/dhairya', false); i = 1; }
  while (i < raw.length) {
    const c = raw[i];
    if (c === '\\') { add(raw[i + 1] ?? '', false); i += 2; continue; }
    if (c === "'") { const j = raw.indexOf("'", i + 1); add(raw.slice(i + 1, j), false); i = j + 1; continue; }
    if (c === '"') {
      i++;
      let s = '';
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\' && '"\\$`'.includes(raw[i + 1])) { s += raw[i + 1]; i += 2; }
        else if (raw[i] === '$') { const [v, n] = expandDollar(raw, i, ctx); s += v; i = n; }
        else s += raw[i++];
      }
      i++;
      add(s, false);
      continue;
    }
    if (c === '$') {
      const [v, n] = expandDollar(raw, i, ctx);
      i = n;
      // Unquoted expansions are split on whitespace into separate fields.
      const parts = v.split(/[ \t\n]+/);
      parts.forEach((p, k) => {
        if (k > 0) end();
        if (p !== '') add(p, true);
      });
      continue;
    }
    add(c, true); i++;
  }
  end();
  const words = [];
  for (const f of fields) {
    const matches = f.glob && ctx.glob ? ctx.glob(f.pat) : [];
    if (matches.length) words.push(...matches);
    else words.push(f.v);
  }
  return words;
}

// Glob pattern (one path segment) → RegExp. Backslash-escaped chars are literal.
export function globToRegExp(pat, flags = '') {
  let re = '';
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === '\\') { re += (pat[++i] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    else if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const j = pat.indexOf(']', i + 2);
      if (j < 0) { re += '\\['; continue; }
      let body = pat.slice(i + 1, j);
      if (body[0] === '!') body = '^' + body.slice(1);
      re += '[' + body.replace(/\\/g, '\\\\') + ']';
      i = j;
    } else re += c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', flags);
}

export const hasGlob = (s) => /(^|[^\\])[*?[]/.test(s);

// ── arithmetic ──

// Small recursive-descent evaluator: + - * / % ** ( ), unary - + !,
// comparisons, && ||, and variable names. `float` keeps fractions (bc).
export function arith(expr, vars = {}, { float = false } = {}) {
  const toks = expr.match(/\d+\.\d*|\.\d+|\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!^]/g) || [];
  const rest = expr.replace(/\d+\.\d*|\.\d+|\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!^]|\s/g, '');
  if (rest) throw new Error(`syntax error: invalid arithmetic operator (error token is "${rest}")`);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const num = (v) => float ? v : Math.trunc(v);
  function primary() {
    const t = next();
    if (t === undefined) throw new Error('syntax error: operand expected');
    if (t === '(') { const v = or(); if (next() !== ')') throw new Error("syntax error: missing `)'"); return v; }
    if (t === '-') return -unary();
    if (t === '+') return unary();
    if (t === '!') return unary() ? 0 : 1;
    if (/^[\d.]/.test(t)) return Number(t);
    if (/^[A-Za-z_]/.test(t)) { const v = Number(vars[t] ?? 0); return Number.isNaN(v) ? 0 : v; }
    throw new Error(`syntax error: operand expected (error token is "${t}")`);
  }
  function unary() { return primary(); }
  function power() {
    const b = unary();
    if (peek() === '**' || peek() === '^') { next(); return b ** power(); }
    return b;
  }
  function mul() {
    let v = power();
    while (['*', '/', '%'].includes(peek())) {
      const op = next(); const r = power();
      if ((op === '/' || op === '%') && r === 0) throw new Error('division by 0');
      v = op === '*' ? v * r : op === '/' ? num(v / r) : v % r;
    }
    return v;
  }
  function add() {
    let v = mul();
    while (peek() === '+' || peek() === '-') { const op = next(); const r = mul(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function cmp() {
    let v = add();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
      const op = next(); const r = add();
      v = Number(op === '<' ? v < r : op === '>' ? v > r : op === '<=' ? v <= r : op === '>=' ? v >= r : op === '==' ? v === r : v !== r);
    }
    return v;
  }
  function and() { let v = cmp(); while (peek() === '&&') { next(); const r = cmp(); v = Number(!!v && !!r); } return v; }
  function or() { let v = and(); while (peek() === '||') { next(); const r = and(); v = Number(!!v || !!r); } return v; }
  if (!toks.length) return 0;
  const v = or();
  if (p < toks.length) throw new Error(`syntax error in expression (error token is "${toks[p]}")`);
  return v;
}

// ── history expansion ──

// !! (last), !n (nth), !-n (n back), !prefix. `history` is most-recent-first.
export function expandHistory(line, history) {
  if (!line.includes('!')) return line;
  let inSingle = false, out = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'") inSingle = !inSingle;
    if (c !== '!' || inSingle) { out += c; continue; }
    const m = line.slice(i + 1).match(/^(!|-?\d+|[A-Za-z][^\s;|&]*)/);
    if (!m) { out += c; continue; }
    const ref = m[1];
    let hit;
    if (ref === '!') hit = history[0];
    else if (/^-\d+$/.test(ref)) hit = history[Number(ref.slice(1)) - 1];
    else if (/^\d+$/.test(ref)) hit = history[history.length - Number(ref)];
    else hit = history.find(h => h.startsWith(ref));
    if (hit === undefined) throw new ShellSyntaxError(`event not found: ${ref}`);
    out += hit;
    i += ref.length;
  }
  return out;
}
