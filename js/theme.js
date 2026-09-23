// Theme + cheat mode for the terminal.
// Embedded: the parent page owns both and pushes changes over the bridge.
// Standalone: the page's own toolbar buttons (and the Konami code) drive them.
// The theme key is shared with the main site (same origin, same localStorage).

import { embedded, on } from './bridge.js';

const root = document.documentElement;
const themeBtn = document.querySelector('[data-theme-toggle]');
const cheatBtn = document.querySelector('[data-secret-toggle]');

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  if (themeBtn) {
    themeBtn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

// Shell easter eggs gate on window._cheatMode.
export function setCheatMode(on) {
  window._cheatMode = on;
  document.body.classList.toggle('palette-flip', on);
  if (cheatBtn) {
    cheatBtn.textContent = on ? 'Cheat ON 🔓' : 'Cheat code';
    cheatBtn.setAttribute('aria-pressed', String(on));
  }
}

export const toggleCheatMode = () => setCheatMode(!window._cheatMode);

export function initTheme() {
  applyTheme(root.getAttribute('data-theme') || 'dark');
  setCheatMode(false);
  if (embedded) {
    on('theme', (msg) => applyTheme(msg.theme === 'light' ? 'light' : 'dark'));
    on('cheat', (msg) => setCheatMode(!!msg.on));
    return;
  }
  themeBtn?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    applyTheme(next);
  });
  cheatBtn?.addEventListener('click', toggleCheatMode);
}
