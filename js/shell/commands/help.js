// `help`, `whatis` — the command index, generated from docs.js.

import { w, wErr, esc } from '../output.js';
import { DOCS, CATEGORIES, manPage } from './docs.js';

export const helpCommands = {
  help(args) {
    if (args[0]) { if (!manPage(args[0])) { wErr(`help: no help topics match \`${args[0]}'`); return 1; } return; }
    w(`<span style="color:var(--color-primary)">nextcube shell — ${Object.keys(DOCS).length} commands. <span style="color:var(--color-text-faint)">man &lt;cmd&gt; or help &lt;cmd&gt; for details.</span></span>`);
    for (const cat of CATEGORIES) {
      const names = Object.keys(DOCS).filter(n => DOCS[n][0] === cat);
      w('');
      w(`<span style="color:var(--color-gold)">${esc(cat)}</span>`);
      w(`  <span style="color:var(--color-green)">${names.map(esc).join('  ')}</span>`);
    }
    w('');
    w(`<span style="color:var(--color-gold)">Shell features</span>`);
    const f = (s) => `<span style="color:var(--color-text-muted)">${s}</span>`;
    w(`  ${f('pipes <span style="color:var(--color-green)">a | b</span>, redirects <span style="color:var(--color-green)">&gt; &gt;&gt; &lt; 2&gt; 2&gt;&amp;1</span>, lists <span style="color:var(--color-green)">; &amp;&amp; ||</span>')}`);
    w(`  ${f('quotes, <span style="color:var(--color-green)">$VAR ${VAR} $? $(cmd) $((1+2))</span>, globs <span style="color:var(--color-green)">* ? [abc]</span>, <span style="color:var(--color-green)">~</span>')}`);
    w(`  ${f('history <span style="color:var(--color-green)">!! !n !prefix</span>, aliases (<span style="color:var(--color-green)">ll la l</span>), scripts via <span style="color:var(--color-green)">source</span> or <span style="color:var(--color-green)">chmod +x</span>')}`);
    w(`  ${f('your files in ~ and /tmp are saved in this browser (<span style="color:var(--color-green)">fsreset</span> to undo)')}`);
    w(`<span style="color:var(--color-text-faint)">Keys: ↑/↓ history · Tab complete · Ctrl+C cancel · Ctrl+L clear · Ctrl+A/E/U/K/W line editing</span>`);
  },

  whatis(args) {
    let status = 0;
    for (const a of args) {
      if (DOCS[a]) w(`<span style="color:var(--color-text-faint)">${esc(a.padEnd(12))} - ${esc(DOCS[a][2])}</span>`);
      else { wErr(`${a}: nothing appropriate.`); status = 1; }
    }
    return status;
  },
};
