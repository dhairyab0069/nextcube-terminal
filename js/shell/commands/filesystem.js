// Filesystem navigation and inspection: ls, cd, cat, pwd, find, file.

import { w, wErr, wPre, esc, dirSpan, fileSpan } from '../output.js';
import { shell, getNode, resolvePath, setCwd } from '../state.js';

export const filesystemCommands = {
  ls(args) {
    const longFmt = args.some(a => a.startsWith('-') && a.includes('l'));
    const showHidden = args.some(a => a.startsWith('-') && a.includes('a'));
    const targetArg = args.find(a => !a.startsWith('-'));
    const targetPath = targetArg ? resolvePath(targetArg) : shell.cwd;
    const node = getNode(targetPath);
    if (!node) { wErr(`ls: ${targetArg}: No such file or directory`); return; }
    if (node.type !== 'dir') { wErr(`ls: ${targetArg}: Not a directory`); return; }
    const entries = Object.entries(node.entries)
      .filter(([n, e]) => showHidden || !e.hidden);
    if (longFmt) {
      w(`<span style="color:var(--color-text-faint)">total ${entries.length}</span>`);
      if (showHidden) {
        w(`<span style="color:var(--color-text-faint)">drwxr-xr-x  dhairya  -    May 16  </span>${dirSpan('.')}`);
        w(`<span style="color:var(--color-text-faint)">drwxr-xr-x  dhairya  -    Sep  1  </span>${dirSpan('..')}`);
      }
      for (const [name, entry] of entries) {
        const isDir = entry.type === 'dir';
        const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
        const size  = isDir ? '      -' : String(entry.size || 0).padStart(7);
        const mod   = (entry.modified || 'Jan  1 00:00').padEnd(14);
        const nameHtml = isDir ? dirSpan(name) : fileSpan(name);
        w(`<span style="color:var(--color-text-faint)">${perms}  dhairya  ${size}  ${mod} </span>${nameHtml}`);
      }
    } else {
      const chunks = entries.map(([name, entry]) =>
        `<span style="display:inline-block;min-width:18ch;margin-bottom:.1rem">${entry.type==='dir' ? dirSpan(name) : fileSpan(name)}</span>`
      );
      // 3 per row
      for (let i = 0; i < chunks.length; i += 3) {
        w(chunks.slice(i, i+3).join(''));
      }
    }
  },


  cd(args) {
    const target = args[0];
    const newPath = resolvePath(target);
    if (newPath.length > 0) {
      const node = getNode(newPath);
      if (!node) { wErr(`cd: ${target}: No such file or directory`); return; }
      if (node.type !== 'dir') { wErr(`cd: ${target}: Not a directory`); return; }
    }
    setCwd(newPath);
  },

  cat(args) {
    if (!args.length) { wErr('cat: missing operand'); return; }
    for (const arg of args) {
      const p = resolvePath(arg);
      const node = getNode(p);
      if (!node) { wErr(`cat: ${arg}: No such file or directory`); continue; }
      if (node.type === 'dir') { wErr(`cat: ${arg}: Is a directory`); continue; }
      wPre(node.content);
    }
  },

  pwd() {
    const full = shell.cwd.length === 0 ? '/home/dhairya' : '/home/dhairya/' + shell.cwd.join('/');
    w(`<span style="color:var(--color-text)">${esc(full)}</span>`);
  },


  find(args) {
    const root = args[0] === '.' || !args[0] ? shell.cwd : resolvePath(args[0]);
    const nameFlag = args.findIndex(a => a === '-name');
    const pattern = nameFlag >= 0 ? args[nameFlag+1] : null;
    const typeFlag = args.findIndex(a => a === '-type');
    const typeFilter = typeFlag >= 0 ? args[typeFlag+1] : null;
    const f = `style="color:var(--color-text-faint)"`;
    function walk(pathArr, node) {
      const pathStr = '~' + (pathArr.length ? '/' + pathArr.join('/') : '');
      const name = pathArr[pathArr.length-1] || '~';
      const matchName = !pattern || name.includes(pattern.replace(/\*/g,''));
      const matchType = !typeFilter || (typeFilter === 'd' ? node.type === 'dir' : typeFilter === 'f' ? node.type === 'file' : true);
      if (matchName && matchType) {
        const isHidden = name.startsWith('.');
        w(`<span style="${isHidden ? 'color:var(--color-gold)' : 'color:var(--color-text-faint)'}">${esc(pathStr)}</span>`);
      }
      if (node.type === 'dir') {
        Object.entries(node.entries).forEach(([n, child]) => walk([...pathArr, n], child));
      }
    }
    const startNode = getNode(root);
    if (!startNode) { wErr(`find: ${args[0]}: No such file or directory`); return; }
    walk(root, startNode);
  },

  file(args) {
    if (!args.length) { wErr('file: missing operand'); return; }
    for (const arg of args) {
      const p = resolvePath(arg);
      const node = getNode(p);
      if (!node) { w(`<span style="color:var(--color-text-faint)">${esc(arg)}: ERROR: No such file or directory</span>`); continue; }
      const name = p[p.length-1] || '';
      let type;
      if (node.type === 'dir') type = 'directory';
      else if (name.endsWith('.elf')) type = 'ELF 32-bit LSB executable, ARM, EABI5, statically linked, not stripped';
      else if (name.endsWith('.pdf')) type = 'PDF document, version 1.4';
      else if (name.endsWith('.md')) type = 'ASCII text, with CRLF line terminators';
      else if (name.endsWith('.txt')) type = 'ASCII text';
      else if (name.endsWith('.rs')) type = 'Rust source code, ASCII text';
      else type = 'ASCII text';
      w(`<span style="color:var(--color-text-faint)">${esc(arg)}: ${esc(type)}</span>`);
    }
  },

};
