// The read-eval-print loop: echoes the typed line, expands history, runs it,
// and owns the input element's key bindings (history, Tab, Ctrl shortcuts).

import { w, wErr, esc, settleScroll, clearScreen } from './output.js';
import { shell } from './state.js';
import { runLine, echoPrompt } from './exec.js';
import { tabComplete } from './completion.js';
import { dgCmd } from './dungeon/engine.js';
import { expandHistory } from './parse.js';
import { saveShellPrefs } from './storage.js';
import { editorOpen } from './editor.js';

const shellInput = document.getElementById('terminal-input');
const shellForm = document.getElementById('terminal-form');
const terminal = document.getElementById('terminal');

function remember(line) {
  if (shell.history[0] !== line && !line.startsWith(' ')) shell.history.unshift(line);
  if (shell.history.length > 500) shell.history.length = 500;
  shell.histIdx = -1;
  saveShellPrefs(shell);
}

function submit(raw) {
  if (window._dgMode) {
    try { dgCmd(raw.trim()); }
    catch (e) { w(`<span style="color:var(--color-magenta)">dungeon error: ${esc(String(e.message))}. type quit to exit.</span>`); }
    remember(raw.trim());
    return;
  }
  let line = raw;
  try {
    const expanded = expandHistory(raw, shell.history);
    echoPrompt(raw);
    if (expanded !== raw) { w(`<span style="color:var(--color-text-faint)">${esc(expanded)}</span>`); line = expanded; }
  } catch (e) {
    wErr(`zsh: ${e.message}`);
    shell.status = 1;
    return;
  }
  if (line.trim()) remember(line.trim());
  runLine(line);
}

// Delete from the cursor back to the start of the previous word.
function killWordBack(v, pos) {
  let i = pos;
  while (i > 0 && /\s/.test(v[i - 1])) i--;
  while (i > 0 && !/\s/.test(v[i - 1])) i--;
  return i;
}

let killRing = '';

export function initRepl() {
  shellForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = shellInput.value;
    shellInput.value = '';
    if (!raw.trim()) { echoPrompt(''); settleScroll(); return; }
    submit(raw);
    if (!editorOpen()) settleScroll();
  });

  shellInput.addEventListener('keydown', (e) => {
    const v = shellInput.value;
    const pos = shellInput.selectionStart ?? v.length;
    const end = shellInput.selectionEnd ?? pos;
    const set = (val, caret = val.length) => { shellInput.value = val; shellInput.setSelectionRange(caret, caret); };
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      if (shell.histIdx < shell.history.length - 1) set(shell.history[++shell.histIdx]);
    } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      if (shell.histIdx > 0) set(shell.history[--shell.histIdx]);
      else { shell.histIdx = -1; set(''); }
    } else if (e.key === 'Tab' && !e.shiftKey && v) {
      // Only complete when there's something to complete, so Tab / Shift+Tab
      // on an empty prompt still move focus out of the terminal.
      e.preventDefault();
      set(tabComplete(v.slice(0, pos)) + v.slice(pos), undefined);
      shellInput.setSelectionRange(shellInput.value.length - (v.length - pos), shellInput.value.length - (v.length - pos));
      settleScroll();
    } else if (e.ctrlKey && !e.altKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'c' && pos === end) {
        e.preventDefault();
        echoPrompt(v + '^C');
        set(''); shell.histIdx = -1; shell.status = 130;
        settleScroll();
      } else if (k === 'l') { e.preventDefault(); clearScreen(); }
      else if (k === 'u') { e.preventDefault(); killRing = v.slice(0, pos); set(v.slice(pos), 0); }
      else if (k === 'k') { e.preventDefault(); killRing = v.slice(pos); set(v.slice(0, pos), pos); }
      else if (k === 'w') { e.preventDefault(); const i = killWordBack(v, pos); killRing = v.slice(i, pos); set(v.slice(0, i) + v.slice(pos), i); }
      else if (k === 'y') { e.preventDefault(); set(v.slice(0, pos) + killRing + v.slice(pos), pos + killRing.length); }
      else if (k === 'a') { e.preventDefault(); shellInput.setSelectionRange(0, 0); }
      else if (k === 'e') { e.preventDefault(); shellInput.setSelectionRange(v.length, v.length); }
      else if (k === 'd' && !v) { e.preventDefault(); submit('exit'); settleScroll(); }
    }
  });

  // Clicking anywhere in the terminal focuses the prompt, unless the visitor
  // is selecting text or clicking a link.
  terminal.addEventListener('click', (e) => {
    if (editorOpen() || e.target.closest('a, button, textarea, input')) return;
    if (String(window.getSelection?.() || '')) return;
    shellInput.focus({ preventScroll: true });
  });
}
