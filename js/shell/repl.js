// The read-eval-print loop: echoes the typed line, dispatches it, and owns the
// input element's history (↑/↓) and Tab bindings.

import { w, wErr, esc, settleScroll } from './output.js';
import { shell, formatCwd } from './state.js';
import { CMDS } from './commands/index.js';
import { tabComplete } from './completion.js';
import { dgCmd } from './dungeon/engine.js';

const shellInput = document.getElementById('terminal-input');
const shellForm = document.getElementById('terminal-form');

export function execCmd(line) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  // Echo with styled prompt
  w(`<span style="color:var(--color-green)">dhairya@nextcube</span><span style="color:var(--color-text-faint)">:</span><span style="color:var(--color-primary)">${esc(formatCwd())}</span><span style="color:var(--color-text-faint)">$</span> <span style="color:var(--color-text)">${esc(line)}</span>`);
  if (CMDS[cmd]) CMDS[cmd](args);
  else if (cmd) wErr(`${cmd}: command not found  (try 'help')`);
}

export function initRepl() {
  shellForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = shellInput.value.trim();
    if (!line) return;
    shell.history.unshift(line);
    shell.histIdx = -1;
    if (window._dgMode) { try { dgCmd(line); } catch(e) { w(`<span style="color:var(--color-magenta)">dungeon error: ${esc(String(e.message))}. type quit to exit.</span>`); } }
    else { execCmd(line); }
    shellInput.value = '';
    settleScroll();
  });

  shellInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (shell.histIdx < shell.history.length - 1) shellInput.value = shell.history[++shell.histIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      shell.histIdx > 0 ? (shellInput.value = shell.history[--shell.histIdx]) : (shell.histIdx = -1, shellInput.value = '');
    } else if (e.key === 'Tab' && !e.shiftKey && shellInput.value) {
      // Only complete when there's something to complete, so Tab / Shift+Tab
      // on an empty prompt still move focus out of the terminal.
      e.preventDefault();
      shellInput.value = tabComplete(shellInput.value);
      settleScroll();
    }
  });
}
