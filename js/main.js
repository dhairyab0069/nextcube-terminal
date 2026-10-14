// Entry point for the nextcube terminal, standalone or embedded.

import { initBridge, send, embedded } from './bridge.js';
import { initTheme } from './theme.js';
import { initKonami } from './konami.js';
import { loadFs, loadShellPrefs } from './shell/storage.js';
import { initRepl } from './shell/repl.js';
import { updatePromptLabel, shell } from './shell/state.js';
import { printBanner } from './shell/banner.js';
import { mountPublications } from './publications.js';
import { ctfState } from './ctf/flags.js';

initTheme();
initBridge();     // after initTheme so the parent's first theme/cheat message is handled
initKonami();

loadFs();             // restore the visitor's files before anything reads the VFS
loadShellPrefs(shell);
initRepl();
updatePromptLabel();
printBanner();
mountPublications();

// Standalone, the terminal is the whole page, so start with the prompt focused.
// (Embedded, don't steal focus from the host page.)
if (!embedded) document.getElementById('terminal-input').focus();

// Tell the embedding page about every capture so its scoreboard can update.
window.addEventListener('ctf:update', () => send('ctf', { found: [...ctfState.found] }));
