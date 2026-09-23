// Messaging between the terminal and the page that embeds it.
//
// The main site (dhairyab0069.github.io) loads this app in a same-origin iframe
// at /nextcube-terminal/?embed=1. Both sides only accept messages from the
// same origin and tag them with `source` so unrelated postMessage traffic is
// ignored.
//
//   terminal → parent   { source: 'nextcube-terminal', type: 'ready' }
//                        { source: 'nextcube-terminal', type: 'ctf', found: [1, 2, 6] }
//                        { source: 'nextcube-terminal', type: 'flip' }
//   parent → terminal   { source: 'nextcube-site', type: 'theme', theme: 'light' | 'dark' }
//                        { source: 'nextcube-site', type: 'cheat', on: true | false }
//
// Standalone (not embedded), send() is a no-op and handlers never fire.

export const embedded = window.parent !== window && new URLSearchParams(location.search).has('embed');

const handlers = {};

export function send(type, data = {}) {
  if (!embedded) return;
  window.parent.postMessage({ source: 'nextcube-terminal', type, ...data }, location.origin);
}

export function on(type, fn) {
  handlers[type] = fn;
}

export function initBridge() {
  if (!embedded) return;
  document.documentElement.classList.add('embedded');
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const msg = e.data;
    if (!msg || msg.source !== 'nextcube-site') return;
    handlers[msg.type]?.(msg);
  });
  send('ready');
}
