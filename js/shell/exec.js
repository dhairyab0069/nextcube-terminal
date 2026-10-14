// Runs command lines: lists (; && ||), pipelines, redirections, aliases,
// variable assignments and command lookup. Commands are `(args, ctx) => status`
// where ctx.stdin is the piped/redirected input (string) or null.

import {
  w, wErr, esc, startCapture, endCapture, startErrCapture, endErrCapture, takeErrored,
} from './output.js';
import { shell, formatCwd, resolvePath, getNode } from './state.js';
import { tokenize, parse, expandWord } from './parse.js';
import { glob, writeFile, readText } from './fs.js';
import { CMDS } from './commands/index.js';

const MAX_DEPTH = 16;
let depth = 0;
let scriptArgs = [];

const ctxFor = () => ({
  env: shell.env,
  status: shell.status,
  args: scriptArgs,
  glob,
  subst: (src) => { startCapture(); try { runLine(src); } finally { return endCapture(); } },
});

export function echoPrompt(line) {
  w(`<span style="color:var(--color-green)">dhairya@nextcube</span><span style="color:var(--color-text-faint)">:</span><span style="color:var(--color-primary)">${esc(formatCwd())}</span><span style="color:var(--color-text-faint)">$</span> <span style="color:var(--color-text)">${esc(line)}</span>`);
}

// Run one line of shell; returns its exit status (also left in shell.status).
export function runLine(line) {
  if (depth >= MAX_DEPTH) { wErr('zsh: maximum nested function level reached'); return (shell.status = 1); }
  let list;
  try { list = parse(tokenize(line)); }
  catch (e) { wErr(`zsh: ${e.message}`); return (shell.status = 2); }
  depth++;
  try {
    for (const { connector, pipeline } of list) {
      if (connector === '&&' && shell.status !== 0) continue;
      if (connector === '||' && shell.status === 0) continue;
      shell.status = runPipeline(pipeline);
    }
  } finally { depth--; }
  return shell.status;
}

function expandAll(words) {
  const ctx = ctxFor();
  return words.flatMap(raw => expandWord(raw, ctx));
}

function runPipeline(cmds) {
  let stdin = null;
  let status = 0;
  cmds.forEach((cmd, i) => {
    const last = i === cmds.length - 1;
    let words, input = stdin, out = null, err = null;
    try {
      words = expandAll(cmd.words);
      for (const r of cmd.redirs) {
        if (r.op === '2>&1') { err = { merge: true }; continue; }
        const target = expandAll([r.target]);
        if (target.length !== 1) throw new Error(`${r.target}: ambiguous redirect`);
        const path = resolvePath(target[0]);
        if (r.op === '<') {
          try { input = readText(target[0]); }
          catch (e) { throw new Error(`${target[0]}: ${e.message}`); }
        } else if (r.op === '>' || r.op === '>>') out = { path, name: target[0], append: r.op === '>>' };
        else err = { path, name: target[0], append: r.op === '2>>' };
      }
    } catch (e) {
      wErr(`zsh: ${e.message}`);
      status = 1; stdin = '';
      return;
    }
    const capture = !last || out;
    if (capture) startCapture();
    if (err) startErrCapture(!!err.merge);
    try { status = runCommand(words, input); }
    finally {
      const errText = err ? endErrCapture() : '';
      const text = capture ? endCapture() : '';
      if (err?.path) writeTo(err, errText);
      if (out) { if (!writeTo(out, text)) status = 1; stdin = ''; }
      else stdin = text;
    }
  });
  return status;
}

function writeTo({ path, name, append }, text) {
  try { writeFile(path, text, append); return true; }
  catch (e) { wErr(`zsh: ${e.message.toLowerCase()}: ${name}`); return false; }
}

const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/;

export function runCommand(words, stdin = null, aliasDepth = 0) {
  if (!words.length) return 0;
  let k = 0;
  while (k < words.length && ASSIGN_RE.test(words[k])) k++;
  if (k === words.length) {
    for (const wd of words) { const [, n, v] = wd.match(ASSIGN_RE); shell.env[n] = v; }
    return 0;
  }
  words = words.slice(k);   // VAR=x cmd: the prefix assignment is ignored
  let name = words[0];
  const alias = shell.aliases[name];
  if (alias !== undefined && aliasDepth < 8) {
    let expanded;
    try { expanded = expandAll(tokenize(alias).map(t => t.v)); }
    catch (e) { wErr(`zsh: ${e.message}`); return 1; }
    return runCommand([...expanded, ...words.slice(1)], stdin, aliasDepth + 1);
  }
  let fn = Object.hasOwn(CMDS, name) ? CMDS[name] : null;
  if (!fn && name.includes('/')) {
    const path = resolvePath(name);
    const node = getNode(path);
    if (!node) { wErr(`zsh: no such file or directory: ${name}`); return 127; }
    if (node.type === 'dir') { wErr(`zsh: permission denied: ${name}`); return 126; }
    if ((path[0] === 'bin' || path[0] === 'usr') && Object.hasOwn(CMDS, path[path.length - 1])) fn = CMDS[path[path.length - 1]];
    else if (node.exec) return source([name, ...words.slice(1)]);
    else { wErr(`zsh: permission denied: ${name}`); return 126; }
  }
  if (!fn) {
    const lower = name.toLowerCase();
    if (Object.hasOwn(CMDS, lower)) fn = CMDS[lower];
    else { wErr(`zsh: command not found: ${name}`); return 127; }
  }
  takeErrored();
  let ret;
  try { ret = fn(words.slice(1), { stdin, name }); }
  catch (e) { wErr(`${name}: ${e.message}`); takeErrored(); return 1; }
  const errored = takeErrored();
  return typeof ret === 'number' ? ret : errored ? 1 : 0;
}

// `source file [args]`: run each line of a file in this shell.
export function source(args) {
  if (!args.length) { wErr('source: not enough arguments'); return 1; }
  let text;
  try { text = readText(args[0]); }
  catch (e) { wErr(`source: ${e.message.toLowerCase()}: ${args[0]}`); return 1; }
  const saved = scriptArgs;
  scriptArgs = args.slice(1);
  let status = 0;
  try {
    for (const line of text.split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      status = runLine(line);
    }
  } finally { scriptArgs = saved; }
  return status;
}
