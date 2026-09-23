// `help` — the command index shown to visitors.

import { w, esc } from '../output.js';

export const helpCommands = {
  help() {
    w(`<span style="color:var(--color-primary)">Commands:</span>`);
    const cmds = [
      ['ls [-la]',       'list directory'],
      ['cd [dir]',       'change directory'],
      ['cat [file]',     'read a file'],
      ['find [path]',    'search filesystem'],
      ['file [path]',    'identify file type'],
      ['strings [file]', 'extract printable strings'],
      ['checksec [elf]', 'check binary protections'],
      ['readelf [elf]',  'read ELF headers/sections'],
      ['xxd [file]',     'hex dump'],
      ['objdump [elf]',  'disassemble / dump sections'],
      ['ps [aux]',       'active processes'],
      ['uname [-a]',     'system information'],
      ['man [page]',     'manual  (try: man dhairya)'],
      ['history',        'command history'],
      ['clear',          'clear terminal'],
      ['ctf',            'start the CTF challenge 🚩'],
      ['hint [1-5]',     'get a hint for a flag'],
      ['submit FLAG{..}','submit a flag'],
      ['scoreboard',     'see your progress'],
      ['fastfetch',      'system information'],
      ['flip',           '🙃 cheat: flip the page'],
      ['dungeon',        '⚔️  cheat: enter the kernel dungeon'],
    ];
    for (const [cmd, desc] of cmds) {
      w(`  <span style="color:var(--color-green)">${esc(cmd.padEnd(14))}</span><span style="color:var(--color-text-muted)">${esc(desc)}</span>`);
    }
    w(`<span style="color:var(--color-text-faint)">Tip: use ↑/↓ for history, Tab to complete filenames.</span>`);
  },
};
