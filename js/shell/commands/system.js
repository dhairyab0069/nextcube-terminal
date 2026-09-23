// System-flavoured commands: identity, processes, manual page, fastfetch banner.

import { output, w, wErr, esc, pinScroll } from '../output.js';
import { shell } from '../state.js';

export const systemCommands = {
  whoami() { w(`<span style="color:var(--color-green)">dhairya</span>`); },

  uname(args) {
    if (args.includes('-a')) {
      w(`<span style="color:var(--color-text-faint)">NeXTSTEP 4.2 nextcube 68040 #42 Sat Sep 1 00:00:00 EST 2025 Rust/aarch64</span>`);
    } else {
      w(`<span style="color:var(--color-text-faint)">NeXTSTEP</span>`);
    }
  },

  ps(args) {
    w(`<span style="color:var(--color-text-faint)">  PID  STAT  STARTED       COMMAND</span>`);
    const procs = [
      ['    1', 'S', 'Sep  1 2025  ', 'init — nextcube workstation'],
      ['  124', 'R', 'Jan 10 2026  ', 'ta-service — cs3100 khoury college'],
      ['  201', 'R', 'Jan 15 2026  ', 'escalion — rust game engine (nu launch labs)'],
      ['  314', 'R', 'May  2 2026  ', 'cactilab-pipeline'],
      ['  315', 'S', 'May  2 2026  ', '  └─ claude-sonnet — stage 2 codegen (40 turns)'],
      ['  316', 'S', 'May  2 2026  ', '  └─ claude-haiku  — stages 1+3 (fast)'],
      ['  317', 'S', 'May  2 2026  ', '  └─ openhands     — tdd red-phase verifier'],
      ['  400', 'R', 'Jan 26 2026  ', 'gsg-senate — student affairs, northeastern'],
    ];
    for (const [pid, stat, started, cmd] of procs) {
      const faint = cmd.startsWith('  └');
      const col = faint ? 'color:var(--color-text-faint)' : 'color:var(--color-text)';
      w(`<span style="color:var(--color-text-faint)">${esc(pid)}  ${stat}   ${esc(started)} </span><span style="${col}">${esc(cmd)}</span>`);
    }
  },

  history() {
    if (!shell.history.length) { w(`<span style="color:var(--color-text-faint)">(no history)</span>`); return; }
    shell.history.slice().reverse().forEach((cmd, i) => {
      w(`<span style="color:var(--color-text-faint)">${String(i+1).padStart(4)}  </span><span style="color:var(--color-text)">${esc(cmd)}</span>`);
    });
  },


  man(args) {
    const page = args[0];
    if (page === 'dhairya') {
      const g = `style="color:var(--color-gold)"`;
      const p = `style="color:var(--color-primary)"`;
      const t = `style="color:var(--color-text)"`;
      const f = `style="color:var(--color-text-faint)"`;
      w(`<span ${g}>DHAIRYA(1)                User Commands                DHAIRYA(1)</span>`);
      w(``); w(`<span ${p}>NAME</span>`);
      w(`       <span ${t}>dhairya</span> <span ${f}>- ML researcher, MS CS student, builder</span>`);
      w(``); w(`<span ${p}>SYNOPSIS</span>`);
      w(`       <span ${f}>dhairya [--research] [--build] [--teach] [--lead]</span>`);
      w(``); w(`<span ${p}>DESCRIPTION</span>`);
      w(`       <span ${f}>Graduate student at Northeastern University, Khoury College</span>`);
      w(`       <span ${f}>of Computer Science (MS 2025–2027).</span>`);
      w(``);
      w(`       <span ${f}>Builds and evaluates video-language models at ACLab;</span>`);
      w(`       <span ${f}>designed and led the MotionBlind benchmark. Builds agentic</span>`);
      w(`       <span ${f}>code-generation pipelines at CACTILab. Co-founded a Rust</span>`);
      w(`       <span ${f}>game engine studio at NU Launch Labs. GSG Senator.</span>`);
      w(``); w(`<span ${p}>OPTIONS</span>`);
      w(`       <span ${f}>--research    video-LLMs, benchmarking, agentic pipelines</span>`);
      w(`       <span ${f}>--build       Escalion engine, CACTILab Hardware Abstraction Layer pipeline</span>`);
      w(`       <span ${f}>--teach       TA for CS3100, Khoury College</span>`);
      w(`       <span ${f}>--lead        GSG Senator, GLI Emerging Graduate Leader</span>`);
      w(``); w(`<span ${p}>FILES</span>`);
      w(`       <span ${f}>~/about.txt  ~/contact.txt  ~/publications/  ~/research/  ~/projects/</span>`);
      w(``); w(`<span ${p}>SEE ALSO</span>`);
      w(`       <a href="https://dhairyab0069.github.io" target="_blank" rel="noopener" style="color:var(--color-primary)">dhairyab0069.github.io</a>  <a href="https://github.com/dhairyab0069" target="_blank" rel="noopener" style="color:var(--color-primary)">github.com/dhairyab0069</a>`);
      w(``);
      w(`<span ${g}>Northeastern University             May 2026             DHAIRYA(1)</span>`);
    } else if (!page) {
      wErr('man: missing argument');
      w(`Try: <span style="color:var(--color-green)">man dhairya</span>`);
    } else {
      wErr(`No manual entry for ${page}`);
    }
  },



  fastfetch() {
    output.innerHTML = '';
    const g  = `style="color:var(--color-green)"`;
    const p  = `style="color:var(--color-primary)"`;
    const f  = `style="color:var(--color-text-faint)"`;
    const gd = `style="color:var(--color-gold)"`;
    const m  = `style="color:var(--color-magenta)"`;
    const pre = `style="white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"`;
    // art lines — fixed 12 chars wide
    const art = [
      '  .------. ',
      ' /  ____  \\',
      '|  /    \\ |',
      '|  \\____/ |',
      ' \\________/',
      '   NEXCUBE  ',
    ];
    const rows = [
      ['OS',       'NeXTSTEP 4.2 (nextcube 68040)'],
      ['Host',     'Dhairya Bhatia'],
      ['Role',     'MS CS \u00b7 Khoury \u00b7 Northeastern'],
      ['Research', 'ACLab \u00b7 MotionBlind \u00b7 video-LLMs'],
      ['Shell',    'nextcube-term'],
      ['Stack',    'Python \u00b7 PyTorch \u00b7 SLURM \u00b7 Rust'],
      ['Site',     'dhairyab0069.github.io'],
      ['GitHub',   'github.com/dhairyab0069'],
      ['Uptime',   'June 2026'],
      ['Memory',   'caffeine / infinite'],
    ];
    const PAD = '             '; // 13 spaces to match art width
    pinScroll(w(`<span ${m}>dhairya</span><span ${f}>@</span><span ${g}>nextcube</span>`));
    w(`<span ${f}>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</span>`);
    rows.forEach(([k,v], i) => {
      const artCol = i < art.length
        ? `<span ${g}>${art[i]}</span>`
        : `<span>${PAD}</span>`;
      w(`<span ${pre}>${artCol}  <span ${p}>${k.padEnd(9)}</span><span ${f}>${v}</span></span>`);
    });
    w('');
  },

  clear() { output.innerHTML = ''; },
};
