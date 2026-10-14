// Commands that change or describe the filesystem: touch, mkdir, rm, cp, mv,
// tree, du, df, stat, path helpers, chmod, the editor, open, fsreset.

import { w, wErr, esc, dirSpan, fileSpan, execSpan, capturing } from '../output.js';
import { shell, getNode, resolvePath, absPath, isWritable, stamp, setCwd, HOME_PATH } from '../state.js';
import { writeFile, makeDir, removeNode, putNode, updateNode, clone, isAncestor, walk, treeSize } from '../fs.js';
import { resetFs } from '../storage.js';
import { openEditor } from '../editor.js';
import { getopt, humanSize } from './util.js';

const basenameOf = (p) => p.replace(/\/+$/, '').split('/').pop() || '/';

function edit(flavour) {
  return (args) => {
    const name = args.find(a => !a.startsWith('-') && !a.startsWith('+'));
    if (capturing()) { wErr(`${flavour}: standard output is not a terminal`); return 1; }
    if (!name) { openEditor(null, '', { flavour, exists: false, readOnly: false }); return; }
    const path = resolvePath(name);
    const node = getNode(path);
    if (node?.type === 'dir') { wErr(`${flavour}: ${name}: Is a directory`); return 1; }
    const parent = getNode(path.slice(0, -1));
    if (!node && (!parent || parent.type !== 'dir')) { wErr(`${flavour}: ${name}: No such file or directory`); return 1; }
    openEditor(path, node?.content ?? '', { flavour, exists: !!node, readOnly: !isWritable(path) || !!node?.url });
  };
}

export const fileopsCommands = {
  touch(args) {
    if (!args.length) { wErr('touch: missing file operand'); return 1; }
    let status = 0;
    for (const a of args) {
      const path = resolvePath(a);
      const node = getNode(path);
      try {
        if (node) updateNode(path);
        else writeFile(path, '');
      } catch (e) { wErr(`touch: ${a}: ${e.message}`); status = 1; }
    }
    return status;
  },

  mkdir(args) {
    const { opts, rest } = getopt(args, { flags: 'pv' });
    if (!rest.length) { wErr('mkdir: missing operand'); return 1; }
    let status = 0;
    for (const a of rest) {
      try { makeDir(resolvePath(a), !!opts.p); }
      catch (e) { wErr(`mkdir: ${a}: ${e.message}`); status = 1; }
    }
    return status;
  },

  rmdir(args) {
    if (!args.length) { wErr('rmdir: missing operand'); return 1; }
    let status = 0;
    for (const a of args) {
      const path = resolvePath(a);
      const node = getNode(path);
      try {
        if (!node) throw new Error('No such file or directory');
        if (node.type !== 'dir') throw new Error('Not a directory');
        if (Object.keys(node.entries).length) throw new Error('Directory not empty');
        removeNode(path);
      } catch (e) { wErr(`rmdir: ${a}: ${e.message}`); status = 1; }
    }
    return status;
  },

  rm(args) {
    const { opts, rest } = getopt(args, { flags: 'rRfiv' });
    const recursive = opts.r || opts.R;
    if (!rest.length) { if (opts.f) return 0; wErr('usage: rm [-f | -i] [-dIPRrvWx] file ...'); return 1; }
    let status = 0;
    for (const a of rest) {
      const path = resolvePath(a);
      if (!path.length) { wErr(recursive ? 'rm: nice try. "/" stays.' : 'rm: "/" is a directory'); status = 1; continue; }
      if (basenameOf(a) === '.' || basenameOf(a) === '..') { wErr(`rm: "." and ".." may not be removed`); status = 1; continue; }
      const node = getNode(path);
      try {
        if (!node) { if (opts.f) continue; throw new Error('No such file or directory'); }
        if (node.type === 'dir' && !recursive) throw new Error('is a directory');
        removeNode(path);
        if (opts.v) w(`<span style="color:var(--color-text-faint)">${esc(a)}</span>`);
      } catch (e) { wErr(`rm: ${a}: ${e.message}`); status = 1; }
    }
    if (!getNode(shell.cwd)) setCwd([...HOME_PATH]);
    return status;
  },

  cp(args) {
    const { opts, rest } = getopt(args, { flags: 'rRfiv' });
    if (rest.length < 2) { wErr('usage: cp [-r] source_file target_file'); return 1; }
    return transfer(rest, 'cp', (src, node, dest) => {
      if (node.type === 'dir' && !(opts.r || opts.R)) throw new Error(`${src} is a directory (not copied).`);
      putNode(dest, Object.assign(clone(node), { modified: stamp() }));
    });
  },

  mv(args) {
    const { rest } = getopt(args, { flags: 'fiv' });
    if (rest.length < 2) { wErr('usage: mv source target'); return 1; }
    return transfer(rest, 'mv', (src, node, dest, srcPath) => {
      if (!isWritable(srcPath)) throw new Error('Permission denied');
      if (node.type === 'dir' && isAncestor(srcPath, dest)) throw new Error(`cannot move '${src}' to a subdirectory of itself`);
      putNode(dest, node);
      removeNode(srcPath);
      if (isAncestor(srcPath, shell.cwd)) setCwd([...dest, ...shell.cwd.slice(srcPath.length)]);
    });
  },

  ln() { wErr('ln: links are not supported on this filesystem'); return 1; },

  tree(args) {
    const { opts, rest } = getopt(args, { flags: 'ad', valued: 'L' });
    const start = rest[0] || '.';
    const root = resolvePath(start);
    const node = getNode(root);
    if (!node) { wErr(`${start} [error opening dir]`); return 2; }
    const depthLimit = opts.L ? Number(opts.L) : Infinity;
    let dirs = 0, files = 0;
    w(node.type === 'dir' ? dirSpan(start).replace(/\/<\/span>$/, '</span>') : fileSpan(start));
    const draw = (n, prefix, depth) => {
      if (depth >= depthLimit || n.locked) return;
      const names = Object.keys(n.entries).sort()
        .filter(k => (opts.a || !k.startsWith('.')) && (!opts.d || n.entries[k].type === 'dir'));
      names.forEach((k, i) => {
        const child = n.entries[k];
        const last = i === names.length - 1;
        const label = child.type === 'dir' ? dirSpan(k) : child.exec ? execSpan(k) : fileSpan(k);
        w(`<span style="color:var(--color-text-faint)">${prefix}${last ? '└── ' : '├── '}</span>${label}`);
        if (child.type === 'dir') { dirs++; draw(child, prefix + (last ? '    ' : '│   '), depth + 1); }
        else files++;
      });
    };
    if (node.type === 'dir') draw(node, '', 0);
    w('');
    w(`<span style="color:var(--color-text-faint)">${dirs} director${dirs === 1 ? 'y' : 'ies'}${opts.d ? '' : `, ${files} file${files === 1 ? '' : 's'}`}</span>`);
  },

  du(args) {
    const { opts, rest } = getopt(args, { flags: 'shac' });
    const fmt = (n) => opts.h ? humanSize(n) : String(Math.ceil(n / 1024));
    let status = 0;
    for (const t of rest.length ? rest : ['.']) {
      const root = resolvePath(t);
      const node = getNode(root);
      if (!node) { wErr(`du: ${t}: No such file or directory`); status = 1; continue; }
      if (opts.s || node.type !== 'dir') { w(`${esc(fmt(treeSize(node)).padEnd(8))}${esc(t)}`); continue; }
      const rows = [];
      walk(root, node, (p, n) => {
        if (n.type === 'dir' || opts.a) rows.push([treeSize(n), p.length === root.length ? t : `${t.replace(/\/$/, '')}/${p.slice(root.length).join('/')}`]);
      });
      rows.reverse().forEach(([n, label]) => w(`${esc(fmt(n).padEnd(8))}${esc(label)}`));
    }
    return status;
  },

  df(args) {
    const h = args.includes('-h');
    const used = treeSize(getNode([]));
    const size = 64 * 1024 * 1024;
    const f = (n) => h ? humanSize(n) : String(Math.round(n / 1024));
    w(`<span style="color:var(--color-text-faint)">Filesystem      ${h ? 'Size ' : '1K-blocks'}  Used  Avail Capacity  Mounted on</span>`);
    w(`/dev/disk0s1    ${f(size).padStart(h ? 5 : 9)}  ${f(used).padStart(4)}  ${f(size - used).padStart(5)}    ${Math.max(1, Math.round(used / size * 100))}%     /`);
    w(`localStorage    ${(h ? '5.0M' : '5120').padStart(h ? 5 : 9)}  ${'-'.padStart(4)}  ${'-'.padStart(5)}      -     /home/dhairya`);
  },

  stat(args) {
    if (!args.length) { wErr('stat: missing operand'); return 1; }
    let status = 0;
    for (const a of args) {
      const path = resolvePath(a);
      const node = getNode(path);
      if (!node) { wErr(`stat: ${a}: stat: No such file or directory`); status = 1; continue; }
      const f = (k, v) => w(`<span style="color:var(--color-primary)">${k.padStart(7)}:</span> ${esc(v)}`);
      f('File', absPath(path));
      f('Type', node.type === 'dir' ? 'directory' : node.content ? 'regular file' : 'regular empty file');
      f('Size', String(node.type === 'dir' ? 4096 : node.size ?? (node.content || '').length));
      f('Access', `(${node.type === 'dir' ? (node.locked ? '0700/drwx------' : '0755/drwxr-xr-x') : node.exec ? '0755/-rwxr-xr-x' : '0644/-rw-r--r--'})  Uid: ${isWritable(path) ? '(501/dhairya)' : '(0/root)'}`);
      f('Modify', node.modified || 'unknown');
    }
    return status;
  },

  basename(args) {
    if (!args.length) { wErr('usage: basename string [suffix]'); return 1; }
    let b = basenameOf(args[0]);
    if (args[1] && b.endsWith(args[1]) && b !== args[1]) b = b.slice(0, -args[1].length);
    w(esc(b));
  },

  dirname(args) {
    if (!args.length) { wErr('usage: dirname path'); return 1; }
    const p = args[0].replace(/\/+$/, '');
    const i = p.lastIndexOf('/');
    w(esc(i < 0 ? '.' : i === 0 ? '/' : p.slice(0, i)));
  },

  realpath(args) {
    let status = 0;
    for (const a of args.length ? args : ['.']) {
      const path = resolvePath(a);
      if (!getNode(path)) { wErr(`realpath: ${a}: No such file or directory`); status = 1; continue; }
      w(esc(absPath(path)));
    }
    return status;
  },

  chmod(args) {
    if (args.length < 2) { wErr('usage: chmod mode file ...'); return 1; }
    const [mode, ...files] = args;
    let status = 0;
    for (const a of files) {
      const path = resolvePath(a);
      const node = getNode(path);
      if (!node) { wErr(`chmod: ${a}: No such file or directory`); status = 1; continue; }
      if (!isWritable(path)) { wErr(`chmod: ${a}: Operation not permitted`); status = 1; continue; }
      if (node.type !== 'file') continue;
      const octal = /^[0-7]{3,4}$/.test(mode);
      const exec = octal ? /[1357]/.test(mode.slice(-3, -2)) : /\+[rw]*x/.test(mode) ? true : /-[rw]*x/.test(mode) ? false : !!node.exec;
      updateNode(path, (n) => { if (exec) n.exec = true; else delete n.exec; });
    }
    return status;
  },

  chown(args) {
    wErr(`chown: ${args[1] ?? 'file'}: Operation not permitted`);
    return 1;
  },

  nano: edit('nano'),
  edit: edit('nano'),
  vim: edit('vim'),
  vi: edit('vim'),

  open(args) {
    const target = args.find(a => !a.startsWith('-'));
    if (!target) { wErr('Usage: open [file | url]'); return 1; }
    let url = null;
    if (/^https?:\/\//.test(target)) url = target;
    else {
      const node = getNode(resolvePath(target));
      if (!node) { wErr(`The file ${absPath(resolvePath(target))} does not exist.`); return 1; }
      url = node.url || (node.content || '').match(/https?:\/\/\S+/)?.[0];
      if (!url) { wErr(`open: no application knows how to open ${target}. Try: cat ${target}`); return 1; }
    }
    const win = window.open(url, '_blank', 'noopener');
    w(`<span style="color:var(--color-text-faint)">${win === null ? 'Opened' : 'Opening'} <a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--color-primary)">${esc(url)}</a></span>`);
  },

  fsreset(args) {
    if (args[0] !== '-y' && args[0] !== '--yes') {
      w(`<span style="color:var(--color-gold)">This puts ~ and /tmp back the way they shipped and deletes everything you created.</span>`);
      w(`<span style="color:var(--color-text-faint)">Run <span style="color:var(--color-green)">fsreset -y</span> to confirm.</span>`);
      return 1;
    }
    resetFs();
    setCwd([...HOME_PATH]);
    w(`<span style="color:var(--color-green)">Filesystem restored.</span>`);
  },
};

// Shared by cp and mv: `src dest`, or `src... dir`.
function transfer(rest, name, op) {
  const destArg = rest[rest.length - 1];
  const srcs = rest.slice(0, -1);
  const destPath = resolvePath(destArg);
  const destNode = getNode(destPath);
  const intoDir = destNode?.type === 'dir';
  if (srcs.length > 1 && !intoDir) { wErr(`${name}: ${destArg} is not a directory`); return 1; }
  let status = 0;
  for (const src of srcs) {
    const srcPath = resolvePath(src);
    const node = getNode(srcPath);
    try {
      if (!node) throw new Error(`${src}: No such file or directory`);
      const dest = intoDir ? [...destPath, srcPath[srcPath.length - 1]] : destPath;
      if (absPath(dest) === absPath(srcPath)) throw new Error(`${src} and ${destArg} are identical (not copied).`);
      if (getNode(dest)?.type === 'dir' && node.type !== 'dir') throw new Error(`${destArg}: Is a directory`);
      op(src, node, dest, srcPath);
    } catch (e) { wErr(`${name}: ${e.message}`); status = 1; }
  }
  return status;
}
