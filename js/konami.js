// ↑↑↓↓←→←→BA toggles cheat mode (standalone only; embedded, the parent page
// owns cheat mode and forwards it over the bridge).

import { embedded } from './bridge.js';
import { toggleCheatMode } from './theme.js';

const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
const buffer = [];

export function initKonami() {
  if (embedded) return;
  window.addEventListener('keydown', (event) => {
    // Typing in the terminal shouldn't count: ↑/↓ are shell history there.
    if (event.target.closest?.('input, textarea')) { buffer.length = 0; return; }
    buffer.push(event.key);
    if (buffer.length > sequence.length) buffer.shift();
    if (sequence.every((k, i) => buffer[i] === k)) toggleCheatMode();
  });
}
