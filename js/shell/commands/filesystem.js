// Filesystem navigation and inspection: ls, cd, cat, pwd, find, file.

import { w, wErr, wPre, print, esc, dirSpan, fileSpan, execSpan, capturing } from '../output.js';
import { shell, getNode, resolvePath, setCwd, absPath, isWritable } from '../state.js';
import { walk } from '../fs.js';
import { globToRegExp } from '../parse.js';
import { getopt, humanSize } from './util.js';

const nameSpan = (name, e) => e.type === 'dir' ? dirSpan(name) : e.exec ? execSpan(name) : fileSpan(name);
const perms = (e) => e.type === 'dir' ? (e.locked ? 'drwx------' : 'drwxr-xr-x') : e.exec ? '-rwxr-xr-x' : '-rw-r--r--';
const owner = (path) => isWritable(path) ? 'dhairya  staff' : 'root     wheel';

export const filesystemCommands = {
  ls(args) {
    const { opts, rest } = getopt(args, { flags: 'laAh1RFd' });
    const all = opts.a, almost = opts.A, long = opts.l;
    const one = opts['1'] || capturing();
    const targets = rest.length ? rest : ['.'];
    const files = [], dirs = [];
    let status = 0;
    for (const t of targets) {
      const path = resolvePath(t);
      const node = getNode(path);
      if (!node) { wErr(`ls: ${t}: No such file or directory`); status = 1; continue; }
      if (node.type === 'dir' && !opts.d) dirs.push({ t, path, node });
      else files.push({ name: t, path, node });
    }
    const line = ({ name, path, node }) => {
      if (!long) return nameSpan(name, node);
      const size = node.type === 'dir' ? 4096 : (node.size ?? (node.content || '').length);
      const sz = (opts.h ? humanSize(size) : String(size)).padStart(7);
      const mod = (node.modified || 'Jan  1 00:00').padEnd(12);
      return `<span style="color:var(--color-text-faint)">${perms(node)}  ${owner(path)}  ${sz}  ${esc(mod)} </span>${nameSpan(name, node)}`;
    };
    const emit = (items) => {
      if (long || one) { items.forEach(it => w(line(it))); return; }
      const chunks = items.map(it => `<span style="display:inline-block;min-width:18ch;margin-bottom:.1rem">${line(it)}</span>`);
      for (let i = 0; i < chunks.length; i += 4) w(chunks.slice(i, i + 4).join(''));
    };
    emit(files);
    const listDir = ({ t, path, node }, header) => {
      if (node.locked) { wErr(`ls: ${t}: Permission denied`); status = 1; return; }
      if (header) { if (files.length || header === 'more') w(''); w(`<span style="color:var(--color-text-faint)">${esc(t)}:</span>`); }
      const names = Object.keys(node.entries).sort((a, b) => a.replace(/^\./, '').localeCompare(b.replace(/^\./, '')));
      const items = names
        .filter(n => all || almost || !n.startsWith('.'))
        .map(n => ({ name: n, path: [...path, n], node: node.entries[n] }));
      if (all) {
        const parent = getNode(path.slice(0, -1)) || node;
        items.unshift({ name: '.', path, node }, { name: '..', path: path.slice(0, -1), node: parent });
      }
      if (long) w(`<span style="color:var(--color-text-faint)">total ${items.length}</span>`);
      emit(items);
      if (opts.R) {
        for (const n of names) {
          const child = node.entries[n];
          if (child.type === 'dir' && (all || almost || !n.startsWith('.'))) {
            listDir({ t: t === '/' ? '/' + n : `${t}/${n}`, path: [...path, n], node: child }, 'more');
          }
        }
      }
    };
    dirs.forEach((d, i) => listDir(d, (dirs.length + files.length > 1 || opts.R) ? (i ? 'more' : 'first') : null));
    return status;
  },

  cd(args) {
    const target = args[0];
    const newPath = resolvePath(target);
    const node = getNode(newPath);
    if (!node) { wErr(`cd: no such file or directory: ${target}`); return 1; }
    if (node.type !== 'dir') { wErr(`cd: not a directory: ${target}`); return 1; }
    if (node.locked) { wErr(`cd: permission denied: ${target}`); return 1; }
    setCwd(newPath);
    if (target === '-') w(`<span style="color:var(--color-text-faint)">${esc(absPath(newPath))}</span>`);
    return 0;
  },

  cat(args, ctx) {
    const { opts, rest } = getopt(args, { flags: 'nbsAE' });
    let status = 0;
    const files = rest.length ? rest : ['-'];
    let n = 0;
    for (const arg of files) {
      let text;
      if (arg === '-') text = ctx.stdin ?? '';
      else {
        const node = getNode(resolvePath(arg));
        if (!node) { wErr(`cat: ${arg}: No such file or directory`); status = 1; continue; }
        if (node.type === 'dir') { wErr(`cat: ${arg}: Is a directory`); status = 1; continue; }
        text = node.content ?? '';
      }
      if (opts.n || opts.b) {
        const lines = text.replace(/\n$/, '').split('\n');
        text = lines.map(l => (opts.b && !l) ? l : `${String(++n).padStart(6)}\t${l}`).join('\n') + '\n';
      }
      // Plain files print as preformatted text; piped input passes through untouched.
      if (arg === '-' || capturing()) print(text.endsWith('\n') || text === '' ? text : text + '\n');
      else wPre(text);
    }
    return status;
  },

  pwd() {
    w(`<span style="color:var(--color-text)">${esc(absPath(shell.cwd))}</span>`);
  },

  find(args) {
    const starts = [];
    let i = 0;
    while (i < args.length && !args[i].startsWith('-')) starts.push(args[i++]);
    if (!starts.length) starts.push('.');
    const tests = [];
    let maxDepth = Infinity, minDepth = 0;
    for (; i < args.length; i++) {
      const a = args[i], v = args[i + 1];
      if (a === '-name' || a === '-iname') {
        if (v === undefined) { wErr(`find: missing argument to \`${a}'`); return 1; }
        const re = globToRegExp(v, a === '-iname' ? 'i' : '');
        tests.push((p) => re.test(p[p.length - 1] ?? '/')); i++;
      } else if (a === '-type') {
        if (v !== 'f' && v !== 'd') { wErr(`find: Unknown argument to -type: ${v ?? ''}`); return 1; }
        tests.push((p, n) => (v === 'd') === (n.type === 'dir')); i++;
      } else if (a === '-maxdepth') { maxDepth = Number(v); i++; }
      else if (a === '-mindepth') { minDepth = Number(v); i++; }
      else if (a === '-print') { /* default */ }
      else { wErr(`find: unknown predicate \`${a}'`); return 1; }
    }
    let status = 0;
    for (const start of starts) {
      const root = resolvePath(start);
      const node = getNode(root);
      if (!node) { wErr(`find: ${start}: No such file or directory`); status = 1; continue; }
      walk(root, node, (path, n, depth) => {
        if (depth > maxDepth) return false;
        if (n.locked && depth > 0) wErr(`find: ${start.replace(/\/$/, '')}/${path.slice(root.length).join('/')}: Permission denied`);
        if (depth < minDepth || !tests.every(t => t(path, n))) return;
        const rel = path.slice(root.length).join('/');
        const shown = rel ? (start.endsWith('/') ? start + rel : `${start}/${rel}`) : start;
        const hidden = (path[path.length - 1] || '').startsWith('.');
        w(`<span style="${hidden ? 'color:var(--color-gold)' : 'color:var(--color-text-faint)'}">${esc(shown)}</span>`);
      });
    }
    return status;
  },

  file(args) {
    if (!args.length) { wErr('Usage: file [-bchikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding] file ...'); return 1; }
    for (const arg of args) {
      const p = resolvePath(arg);
      const node = getNode(p);
      if (!node) { w(`<span style="color:var(--color-text-faint)">${esc(arg)}: cannot open \`${esc(arg)}' (No such file or directory)</span>`); continue; }
      const name = p[p.length-1] || '';
      let type;
      if (node.type === 'dir') type = 'directory';
      else if (name.endsWith('.elf')) type = 'ELF 32-bit LSB executable, ARM, EABI5, statically linked, not stripped';
      else if (p[0] === 'bin' || p[0] === 'usr') type = 'Mach-O 64-bit executable arm64';
      else if (name.endsWith('.pdf')) type = 'PDF document, version 1.4';
      else if (name.endsWith('.md')) type = 'ASCII text, with CRLF line terminators';
      else if (name.endsWith('.rs')) type = 'Rust source code, ASCII text';
      else if (name.endsWith('.sh') || (node.content || '').startsWith('#!')) type = 'POSIX shell script text executable, ASCII text';
      else if (!(node.content || '').length) type = 'empty';
      else type = 'ASCII text';
      w(`<span style="color:var(--color-text-faint)">${esc(arg)}: ${esc(type)}</span>`);
    }
  },
};
