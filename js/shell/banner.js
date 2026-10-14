// The login banner the terminal opens with.

import { w } from './output.js';

export function printBanner() {
  w(`<span style="color:var(--color-green)">NeXTSTEP 4.2 — nextcube (68040)</span>`);
  w(`<span style="color:var(--color-text-faint)">Last login: ${new Date().toDateString()} on ttys001</span>`);
  w(`<span style="color:var(--color-text-faint)">Try it out — <span style="color:var(--color-green)">ls</span> to browse, <span style="color:var(--color-green)">cat about.txt</span> for bio, <span style="color:var(--color-green)">man dhairya</span> for the full picture.</span>`);
  w(`<span style="color:var(--color-text-faint)">It's a real-ish shell: <span style="color:var(--color-green)">help</span> lists 100+ commands. Pipes, redirects, <span style="color:var(--color-green)">grep</span>, <span style="color:var(--color-green)">awk</span>, <span style="color:var(--color-green)">sed</span>, and <span style="color:var(--color-green)">nano notes.txt</span> to write your own files.</span>`);
  w(`<span style="color:var(--color-text-faint)">Type <span style="color:var(--color-gold)">ctf</span> to start a 5-flag reverse engineering challenge hidden in this filesystem.</span>`);
}
