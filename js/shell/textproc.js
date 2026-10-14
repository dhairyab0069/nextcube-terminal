// sed and awk engines, DOM-free so they can be tested under node.

// ── sed ──
// Supports: s/re/rep/[gip], d, p, with optional address: N, $, /re/, N,M.

function splitDelim(src, i, delim) {
  let out = '';
  while (i < src.length && src[i] !== delim) {
    if (src[i] === '\\' && src[i + 1] === delim) { out += delim; i += 2; }
    else if (src[i] === '\\' && i + 1 < src.length) { out += src[i] + src[i + 1]; i += 2; }
    else out += src[i++];
  }
  if (i >= src.length) throw new Error(`unterminated \`s' command`);
  return [out, i + 1];
}

// sed's BRE-ish syntax → JS: \( \) \| \{ \} become groups/alternation.
const bre = (re) => re.replace(/\\([(){}|+?])/g, '$1');

function parseAddr(src, i) {
  if (src[i] === '$') return [{ last: true }, i + 1];
  const num = src.slice(i).match(/^\d+/);
  if (num) return [{ line: Number(num[0]) }, i + num[0].length];
  if (src[i] === '/') { const [re, j] = splitDelim(src, i + 1, '/'); return [{ re: new RegExp(bre(re)) }, j]; }
  return [null, i];
}

export function compileSed(script) {
  const cmds = [];
  for (const part of script.split(/;|\n/).map(s => s.trim()).filter(Boolean)) {
    let i = 0;
    let [a1, j] = parseAddr(part, i); i = j;
    let a2 = null;
    if (a1 && part[i] === ',') { [a2, j] = parseAddr(part, i + 1); i = j; }
    while (part[i] === ' ') i++;
    let neg = false;
    if (part[i] === '!') { neg = true; i++; }
    const c = part[i];
    if (c === 's') {
      const delim = part[i + 1];
      if (!delim) throw new Error('unterminated `s\' command');
      const [pat, k] = splitDelim(part, i + 2, delim);
      const [rep, m] = splitDelim(part, k, delim);
      const flags = part.slice(m);
      if (/[^gipI0-9]/.test(flags)) throw new Error(`unknown option to \`s'`);
      const re = new RegExp(bre(pat), (flags.includes('g') ? 'g' : '') + (/[iI]/.test(flags) ? 'i' : ''));
      const jsRep = rep.replace(/\$/g, '$$$$').replace(/\\(\d)/g, '$$$1').replace(/(^|[^\\])&/g, '$1$$&').replace(/\\&/g, '&').replace(/\\n/g, '\n');
      cmds.push({ a1, a2, neg, op: 's', re, rep: jsRep, print: flags.includes('p') });
    } else if (c === 'd' || c === 'p' || c === 'q') cmds.push({ a1, a2, neg, op: c });
    else throw new Error(`unknown command: \`${c ?? part}'`);
  }
  return cmds;
}

export function runSed(scripts, text, { quiet = false } = {}) {
  const cmds = scripts.flatMap(compileSed);
  const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n');
  const out = [];
  const ranges = new Map();
  const hit = (a, line, n, last) => a.last ? last : a.line !== undefined ? a.line === n : a.re.test(line);
  for (let n = 1; n <= lines.length; n++) {
    let line = lines[n - 1];
    const last = n === lines.length;
    let deleted = false, quit = false;
    for (const c of cmds) {
      let match;
      if (!c.a1) match = true;
      else if (!c.a2) match = hit(c.a1, line, n, last);
      else {
        const open = ranges.get(c);
        if (open) { match = true; if (hit(c.a2, line, n, last) || (c.a2.line !== undefined && n >= c.a2.line)) ranges.delete(c); }
        else if (hit(c.a1, line, n, last)) { match = true; if (!(c.a2.line !== undefined && c.a2.line <= n)) ranges.set(c, true); }
        else match = false;
      }
      if (c.neg) match = !match;
      if (!match) continue;
      if (c.op === 'd') { deleted = true; break; }
      if (c.op === 'p') out.push(line);
      if (c.op === 'q') { quit = true; break; }
      if (c.op === 's') {
        c.re.lastIndex = 0;
        const replaced = line.replace(c.re, c.rep);
        if (replaced !== line || c.re.test(line)) { line = replaced; if (c.print) out.push(line); }
      }
    }
    if (!deleted && !quit && !quiet) out.push(line);
    if (quit) { if (!quiet) out.push(line); break; }
  }
  return out.length ? out.join('\n') + '\n' : '';
}

// ── awk ──
// A small awk: BEGIN/END, /re/ and expression patterns, actions with print,
// printf-less output, assignments (= += -= *= /= ++ --), if/else, next,
// fields $N/$NF/$0, NR, NF, FS, OFS, string concatenation, ~ and !~,
// length() toupper() tolower() substr() index().

function lexAwk(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { if (c === '\n') toks.push({ t: ';' }); i++; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '"') {
      let s = ''; i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') { const n = src[i + 1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n; i += 2; }
        else s += src[i++];
      }
      i++; toks.push({ t: 'str', v: s }); continue;
    }
    const prev = toks[toks.length - 1];
    const regexOk = !prev || ['(', ',', '{', '}', ';', '!', '~', '!~', '&&', '||', 'op'].includes(prev.t) || (prev.t === 'op' && prev.v !== ')');
    if (c === '/' && regexOk) {
      let s = ''; i++;
      while (i < src.length && src[i] !== '/') { if (src[i] === '\\' && src[i + 1] === '/') { s += '/'; i += 2; } else s += src[i++]; }
      i++; toks.push({ t: 're', v: new RegExp(s) }); continue;
    }
    const num = src.slice(i).match(/^\d+(\.\d+)?/);
    if (num) { toks.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (id) { toks.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    const op = ['+=', '-=', '*=', '/=', '%=', '++', '--', '==', '!=', '<=', '>=', '&&', '||', '!~'].find(o => src.startsWith(o, i));
    if (op) { toks.push({ t: op === '!~' ? '!~' : op === '&&' || op === '||' ? op : 'op', v: op }); i += 2; continue; }
    if ('{}();,!~[]'.includes(c)) { toks.push({ t: c }); i++; continue; }
    if ('+-*/%<>=$?:^'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`syntax error at source line 1: unexpected character '${c}'`);
  }
  return toks;
}

export function compileAwk(src) {
  const toks = lexAwk(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const is = (t, v) => peek() && peek().t === t && (v === undefined || peek().v === v);
  const eat = (t, v) => { if (!is(t, v)) throw new Error(`syntax error at source line 1 near ${peek() ? (peek().v ?? peek().t) : 'end'}`); return toks[p++]; };
  const skipSemis = () => { while (is(';')) p++; };

  // expressions → closures (env) => value
  function primary() {
    const t = toks[p++];
    if (!t) throw new Error('syntax error: unexpected end of program');
    if (t.t === 'num' || t.t === 'str') return () => t.v;
    if (t.t === 're') return (e) => (t.v.test(e.field(0)) ? 1 : 0);
    if (t.t === '(') { const v = expr(); eat(')'); return v; }
    if (t.t === '!') { const v = unary(); return (e) => (truthy(v(e)) ? 0 : 1); }
    if (t.t === 'op' && t.v === '-') { const v = unary(); return (e) => -num(v(e)); }
    if (t.t === 'op' && t.v === '+') { const v = unary(); return (e) => num(v(e)); }
    if (t.t === 'op' && t.v === '$') { const v = primary(); return lval({ field: v }); }
    if (t.t === 'op' && (t.v === '++' || t.v === '--')) {
      const target = primary();
      return (e) => { const n = num(target(e)) + (t.v === '++' ? 1 : -1); target.set(e, n); return n; };
    }
    if (t.t === 'id') {
      if (is('(') ) {
        p++;
        const args = [];
        if (!is(')')) { args.push(expr()); while (is(',')) { p++; args.push(expr()); } }
        eat(')');
        const fn = FUNCS[t.v];
        if (!fn) throw new Error(`calling undefined function ${t.v}`);
        return (e) => fn(...args.map(a => a(e)));
      }
      if (t.v === 'length' ) return (e) => e.field(0).length;
      if (is('[')) { p++; const idx = expr(); eat(']'); return lval({ name: t.v, index: idx }); }
      return lval({ name: t.v });
    }
    throw new Error(`syntax error at source line 1 near ${t.v ?? t.t}`);
  }
  function lval(ref) {
    if (ref.index) {
      const get = (e) => e.arr(ref.name)[String(ref.index(e))] ?? '';
      get.set = (e, v) => { e.arr(ref.name)[String(ref.index(e))] = v; };
      return get;
    }
    const get = ref.field ? (e) => e.field(num(ref.field(e))) : (e) => e.get(ref.name);
    get.set = ref.field ? (e, v) => e.setField(num(ref.field(e)), v) : (e, v) => e.set(ref.name, v);
    return get;
  }
  function postfix() {
    const v = primary();
    if (v.set && is('op') && (peek().v === '++' || peek().v === '--')) {
      const op = toks[p++].v;
      return (e) => { const old = num(v(e)); v.set(e, old + (op === '++' ? 1 : -1)); return old; };
    }
    return v;
  }
  function unary() {
    const b = postfix();
    if (is('op', '^')) { p++; const x = unary(); return (e) => num(b(e)) ** num(x(e)); }
    return b;
  }
  function binary(next, ops, fn) {
    return () => {
      let l = next();
      while (is('op') && ops.includes(peek().v)) { const op = toks[p++].v; const r = next(); const a = l; l = (e) => fn(op, a(e), r(e)); }
      return l;
    };
  }
  const mul = binary(unary, ['*', '/', '%'], (op, a, b) => op === '*' ? num(a) * num(b) : op === '/' ? num(a) / num(b) : num(a) % num(b));
  const add = binary(mul, ['+', '-'], (op, a, b) => op === '+' ? num(a) + num(b) : num(a) - num(b));
  // Concatenation: adjacent expressions that can start a value.
  function concat() {
    let l = add();
    while (peek() && (['num', 'str', 'id', '('].includes(peek().t) || (peek().t === 'op' && peek().v === '$') || (peek().t === '!' && false))) {
      const r = add(); const a = l; l = (e) => String(a(e)) + String(r(e));
    }
    return l;
  }
  function compare() {
    const l = concat();
    if (is('op') && ['<', '>', '<=', '>=', '==', '!='].includes(peek().v)) {
      const op = toks[p++].v; const r = concat();
      return (e) => {
        let a = l(e), b = r(e);
        const numeric = isNum(a) && isNum(b);
        if (numeric) { a = Number(a); b = Number(b); } else { a = String(a); b = String(b); }
        return Number(op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : op === '>=' ? a >= b : op === '==' ? a === b : a !== b);
      };
    }
    if (is('~') || is('!~')) {
      const neg = toks[p++].t === '!~';
      const rt = peek();
      const r = rt && rt.t === 're' ? (p++, () => rt.v) : concat();
      return (e) => { const re = r(e) instanceof RegExp ? r(e) : new RegExp(String(r(e))); return Number(re.test(String(l(e))) !== neg); };
    }
    return l;
  }
  function and() { let l = compare(); while (is('&&')) { p++; const r = compare(); const a = l; l = (e) => Number(truthy(a(e)) && truthy(r(e))); } return l; }
  function or() { let l = and(); while (is('||')) { p++; const r = and(); const a = l; l = (e) => Number(truthy(a(e)) || truthy(r(e))); } return l; }
  function ternary() {
    const c = or();
    if (is('op', '?')) { p++; const a = ternary(); eat('op', ':'); const b = ternary(); return (e) => truthy(c(e)) ? a(e) : b(e); }
    return c;
  }
  function expr() {
    const start = p;
    const l = ternary();
    if (l.set && is('op') && ['=', '+=', '-=', '*=', '/=', '%='].includes(peek().v)) {
      const op = toks[p++].v; const r = expr();
      return (e) => {
        const v = r(e);
        const cur = l(e);
        const n = op === '=' ? v : op === '+=' ? num(cur) + num(v) : op === '-=' ? num(cur) - num(v) : op === '*=' ? num(cur) * num(v) : op === '/=' ? num(cur) / num(v) : num(cur) % num(v);
        l.set(e, n); return n;
      };
    }
    void start;
    return l;
  }

  // statements → closures (env) => void (may throw NEXT)
  function block() {
    eat('{');
    const stmts = [];
    skipSemis();
    while (!is('}')) { stmts.push(statement()); skipSemis(); }
    eat('}');
    return (e) => { for (const s of stmts) s(e); };
  }
  function statement() {
    if (is('{')) return block();
    if (is('id', 'print')) {
      p++;
      const args = [];
      const paren = is('(') && (() => { // print (a, b)
        let depth = 0, k = p;
        for (; k < toks.length; k++) { if (toks[k].t === '(') depth++; if (toks[k].t === ')' && --depth === 0) break; }
        const after = toks[k + 1];
        return !after || after.t === ';' || after.t === '}';
      })();
      if (paren) p++;
      if (!is(';') && !is('}') && !is(')')) { args.push(expr()); while (is(',')) { p++; args.push(expr()); } }
      if (paren) eat(')');
      return (e) => e.out(args.length ? args.map(a => fmt(a(e), e)).join(e.get('OFS')) : e.field(0));
    }
    if (is('id', 'printf')) {
      p++;
      const args = [expr()];
      while (is(',')) { p++; args.push(expr()); }
      return (e) => e.outRaw(sprintf(String(args[0](e)), args.slice(1).map(a => a(e))));
    }
    if (is('id', 'next')) { p++; return () => { throw NEXT; }; }
    if (is('id', 'delete')) { p++; const name = eat('id').v; let idx = null; if (is('[')) { p++; idx = expr(); eat(']'); } return (e) => { if (idx) delete e.arr(name)[String(idx(e))]; else e.clearArr(name); }; }
    if (is('id', 'while')) { p++; eat('('); const c = expr(); eat(')'); skipSemis(); const body = statement(); return (e) => { let guard = 0; while (truthy(c(e))) { body(e); if (++guard > 1e5) throw new Error('loop limit exceeded'); } }; }
    if (is('id', 'for')) {
      p++; eat('(');
      if (is('id') && peek(1)?.t === 'id' && peek(1).v === 'in') {
        const k = toks[p].v; p += 2; const arr = eat('id').v; eat(')'); skipSemis();
        const body = statement();
        return (e) => { for (const key of Object.keys(e.arr(arr))) { e.set(k, key); body(e); } };
      }
      const init = is(';') ? null : expr(); eat(';');
      const cond = is(';') ? null : expr(); eat(';');
      const step = is(')') ? null : expr(); eat(')'); skipSemis();
      const body = statement();
      return (e) => { let guard = 0; for (init?.(e); cond ? truthy(cond(e)) : true; step?.(e)) { body(e); if (++guard > 1e5) throw new Error('loop limit exceeded'); } };
    }
    if (is('id', 'if')) {
      p++; eat('('); const c = expr(); eat(')'); skipSemis();
      const a = statement();
      let b = null;
      const save = p; skipSemis();
      if (is('id', 'else')) { p++; skipSemis(); b = statement(); } else p = save;
      return (e) => { if (truthy(c(e))) a(e); else if (b) b(e); };
    }
    const ex = expr();
    return (e) => { ex(e); };
  }

  const rules = [];
  skipSemis();
  while (p < toks.length) {
    if (is('id', 'BEGIN') || is('id', 'END')) { const kind = toks[p++].v; rules.push({ kind, action: block() }); }
    else {
      let pattern = null;
      if (!is('{')) pattern = expr();
      const action = is('{') ? block() : null;
      rules.push({ kind: 'main', pattern, action });
    }
    skipSemis();
  }
  return rules;
}

const NEXT = Symbol('next');
const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };
const truthy = (v) => typeof v === 'number' ? v !== 0 : v !== '' && v !== '0' && v !== undefined;
const fmt = (v, e) => typeof v === 'number' && !Number.isInteger(v) ? String(Number(v.toPrecision(6))) : String(v ?? '');
const FUNCS = {
  length: (s) => String(s ?? '').length,
  toupper: (s) => String(s).toUpperCase(),
  tolower: (s) => String(s).toLowerCase(),
  substr: (s, m, n) => { s = String(s); const start = Math.max(1, Math.round(num(m))); return n === undefined ? s.slice(start - 1) : s.substr(start - 1, Math.max(0, Math.round(num(n)) - Math.max(0, 1 - Math.round(num(m))))); },
  index: (s, t) => String(s).indexOf(String(t)) + 1,
  int: (x) => Math.trunc(num(x)),
  sqrt: (x) => Math.sqrt(num(x)),
};

// Minimal printf: %s %d %i %f %x %o %c %% with width/precision/flags.
export function sprintf(format, args) {
  let k = 0;
  return format.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifxXoce%])/g, (m, flags, width, prec, conv) => {
    if (conv === '%') return '%';
    const a = args[k++];
    let s;
    switch (conv) {
      case 'd': case 'i': s = String(Math.trunc(num(a))); break;
      case 'f': s = num(a).toFixed(prec === undefined ? 6 : Number(prec)); break;
      case 'e': s = num(a).toExponential(prec === undefined ? 6 : Number(prec)); break;
      case 'x': s = Math.trunc(num(a)).toString(16); break;
      case 'X': s = Math.trunc(num(a)).toString(16).toUpperCase(); break;
      case 'o': s = Math.trunc(num(a)).toString(8); break;
      case 'c': s = typeof a === 'number' ? String.fromCharCode(a) : String(a ?? '').charAt(0); break;
      default: s = String(a ?? ''); if (prec !== undefined) s = s.slice(0, Number(prec));
    }
    if (flags.includes('+') && /[dif]/.test(conv) && num(a) >= 0) s = '+' + s;
    if (width && s.length < Number(width)) {
      const pad = flags.includes('0') && !flags.includes('-') && conv !== 's' ? '0' : ' ';
      s = flags.includes('-') ? s.padEnd(Number(width)) : pad === '0' && /^[+-]/.test(s) ? s[0] + s.slice(1).padStart(Number(width) - 1, '0') : s.padStart(Number(width), pad);
    }
    return s;
  });
}

// inputs: [{ name, text }]; vars: -v assignments. Returns output text.
export function runAwk(program, inputs, { fs = null, vars = {} } = {}) {
  const rules = compileAwk(program);
  const globals = { FS: fs ?? ' ', OFS: ' ', ORS: '\n', NR: 0, NF: 0, FNR: 0, FILENAME: '', ...vars };
  let fields = [''];
  const arrays = {};
  let out = '';
  const split = (line) => {
    const FS = String(globals.FS);
    const parts = FS === ' ' ? line.trim().split(/[ \t]+/).filter(Boolean) : FS.length === 1 ? line.split(FS) : line.split(new RegExp(FS));
    return line === '' ? [] : parts;
  };
  const env = {
    field: (i) => i === 0 ? fields[0] : (fields[i] ?? ''),
    setField: (i, v) => {
      if (i === 0) { fields = [String(v), ...split(String(v))]; globals.NF = fields.length - 1; return; }
      while (fields.length <= i) fields.push('');
      fields[i] = String(v);
      globals.NF = fields.length - 1;
      fields[0] = fields.slice(1).join(String(globals.OFS));
    },
    get: (n) => n === 'NF' ? fields.length - 1 : (globals[n] ?? ''),
    arr: (n) => (arrays[n] ??= {}),
    clearArr: (n) => { arrays[n] = {}; },
    set: (n, v) => { if (n === 'NF') { fields = fields.slice(0, num(v) + 1); fields[0] = fields.slice(1).join(String(globals.OFS)); } globals[n] = v; },
    out: (s) => { out += s + String(globals.ORS); },
    outRaw: (s) => { out += s; },
  };
  const run = (kind) => { for (const r of rules) if (r.kind === kind) r.action(env); };
  run('BEGIN');
  const mains = rules.filter(r => r.kind === 'main');
  if (mains.length || rules.some(r => r.kind === 'END')) {
    for (const input of inputs) {
      globals.FILENAME = input.name === '-' ? '' : input.name;
      globals.FNR = 0;
      const lines = input.text === '' ? [] : input.text.replace(/\n$/, '').split('\n');
      for (const line of lines) {
        globals.NR++; globals.FNR++;
        fields = [line, ...split(line)];
        try {
          for (const r of mains) {
            if (r.pattern && !truthy(r.pattern(env))) continue;
            if (r.action) r.action(env); else env.out(fields[0]);
          }
        } catch (e) { if (e !== NEXT) throw e; }
      }
    }
  }
  run('END');
  return out;
}
