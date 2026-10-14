// Shell builtins and system odds and ends: variables, aliases, type/which,
// source, arithmetic, dates, identity, and polite refusals (sudo, network).

import { w, wErr, print, esc, clearScreen } from '../output.js';
import { shell } from '../state.js';
import { saveShellPrefs } from '../storage.js';
import { arith } from '../parse.js';
import { source } from '../exec.js';
import { printBanner } from '../banner.js';
import { CMDS } from './index.js';
import { inputs, toLines } from './util.js';

export const BUILTINS = new Set([
  'cd', 'pwd', 'echo', 'printf', 'export', 'unset', 'alias', 'unalias', 'type', 'source', '.', 'history',
  'exit', 'logout', 'true', 'false', 'help', 'kill', 'sleep', 'set', 'env',
]);

const savePrefs = () => saveShellPrefs(shell);
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const quote = (v) => /^[\w@%+=:,./-]*$/.test(v) && v !== '' ? v : `'${v.replace(/'/g, `'\\''`)}'`;

const FORTUNES = [
  'There are 10 kinds of people: those who understand binary and those who don\'t.',
  'It works on my machine. — every engineer, eventually',
  'A benchmark is only as honest as its hardest negative. — MotionBlind lab notes',
  'Premature optimization is the root of all evil. — Donald Knuth',
  'The best error message is the one that never shows up. — Thomas Fuchs',
  'Any sufficiently advanced bug is indistinguishable from a feature.',
  'Rust: because segfaults are a lifestyle choice.',
  'Talk is cheap. Show me the code. — Linus Torvalds',
  'Weeks of coding can save you hours of planning.',
  'cat flag.txt | grep -i hope',
];

function netRefusal(cmd) {
  return (args) => {
    const target = args.find(a => !a.startsWith('-')) || '';
    if (!target) { wErr(`${cmd}: missing URL or host`); return 1; }
    wErr(`${cmd}: ${target}: no network inside nextcube. ${/^https?:/.test(target) ? `Try: open ${target}` : 'This machine is a browser tab.'}`);
    return cmd === 'curl' ? 6 : cmd === 'ping' ? 68 : 4;
  };
}

export const envCommands = {
  export(args) {
    if (!args.length || args[0] === '-p') {
      Object.keys(shell.env).sort().forEach(k => print(`export ${k}=${quote(shell.env[k])}\n`));
      return;
    }
    let status = 0;
    for (const a of args) {
      const eq = a.indexOf('=');
      const name = eq < 0 ? a : a.slice(0, eq);
      if (!NAME_RE.test(name)) { wErr(`export: not valid in this context: ${name}`); status = 1; continue; }
      if (eq >= 0) shell.env[name] = a.slice(eq + 1);
      shell.userVars[name] = shell.env[name] ?? '';
    }
    savePrefs();
    return status;
  },

  unset(args) {
    for (const n of args) { delete shell.env[n]; delete shell.userVars[n]; }
    savePrefs();
  },

  env(args) {
    if (args.length) { wErr('env: running commands with a modified environment is not supported; try: export NAME=value'); return 1; }
    Object.keys(shell.env).sort().forEach(k => print(`${k}=${shell.env[k]}\n`));
  },

  printenv(args) {
    if (!args.length) return envCommands.env([]);
    let status = 0;
    for (const n of args) { if (n in shell.env) print(shell.env[n] + '\n'); else status = 1; }
    return status;
  },

  set() { Object.keys(shell.env).sort().forEach(k => print(`${k}=${quote(shell.env[k])}\n`)); },

  alias(args) {
    if (!args.length) {
      Object.keys(shell.aliases).sort().forEach(k => print(`${k}=${quote(shell.aliases[k])}\n`));
      return;
    }
    let status = 0;
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq < 0) {
        if (a in shell.aliases) print(`${a}=${quote(shell.aliases[a])}\n`);
        else { wErr(`alias: ${a}: not found`); status = 1; }
        continue;
      }
      const name = a.slice(0, eq);
      if (!name || /[\s/$`'"=]/.test(name)) { wErr(`alias: invalid alias name: ${name}`); status = 1; continue; }
      shell.aliases[name] = a.slice(eq + 1);
      shell.unaliased = shell.unaliased.filter(x => x !== name);
    }
    savePrefs();
    return status;
  },

  unalias(args) {
    if (args[0] === '-a') { shell.unaliased.push(...Object.keys(shell.aliases)); shell.aliases = {}; savePrefs(); return; }
    let status = 0;
    for (const a of args) {
      if (!(a in shell.aliases)) { wErr(`unalias: no such hash table element: ${a}`); status = 1; continue; }
      delete shell.aliases[a];
      shell.unaliased.push(a);
    }
    savePrefs();
    return status;
  },

  type(args) {
    let status = 0;
    for (const n of args) {
      if (n in shell.aliases) print(`${n} is an alias for ${shell.aliases[n]}\n`);
      else if (BUILTINS.has(n)) print(`${n} is a shell builtin\n`);
      else if (Object.hasOwn(CMDS, n)) print(`${n} is /bin/${n}\n`);
      else { wErr(`${n} not found`); status = 1; }
    }
    return status;
  },

  which(args) {
    let status = 0;
    for (const n of args.filter(a => !a.startsWith('-'))) {
      if (n in shell.aliases) print(`${n}: aliased to ${shell.aliases[n]}\n`);
      else if (BUILTINS.has(n)) print(`${n}: shell built-in command\n`);
      else if (Object.hasOwn(CMDS, n)) print(`/bin/${n}\n`);
      else { wErr(`${n} not found`); status = 1; }
    }
    return status;
  },

  source: (args) => source(args),
  '.': (args) => source(args),
  sh: (args) => args.length ? source(args) : (w('<span style="color:var(--color-text-faint)">you are already in a shell :)</span>'), 0),
  bash: (args) => envCommands.sh(args),
  zsh: (args) => envCommands.sh(args),

  true: () => 0,
  false: () => 1,
  sleep(args) {
    if (!args.length || Number.isNaN(parseFloat(args[0]))) { wErr('usage: sleep seconds'); return 1; }
  },

  expr(args) {
    if (!args.length) { wErr('usage: expr expression'); return 2; }
    // String forms first: length STR, STR : REGEX
    if (args[0] === 'length' && args.length === 2) { print(args[1].length + '\n'); return; }
    if (args.length === 3 && args[1] === ':') {
      const m = args[0].match(new RegExp('^(?:' + args[2] + ')'));
      print((m ? (m[1] ?? m[0].length) : 0) + '\n');
      return m ? 0 : 1;
    }
    try {
      const v = arith(args.join(' ').replace(/(^|\s)=(\s|$)/g, '$1==$2').replace(/\\\*/g, '*'), shell.env);
      print(v + '\n');
      return v === 0 ? 1 : 0;
    } catch (e) { wErr(`expr: ${e.message}`); return 2; }
  },

  bc(args, ctx) {
    const exprs = args.length && !args[0].startsWith('-') ? [args.join(' ')] : toLines(inputs([], ctx, 'bc')[0].text);
    if (!exprs.length) { wErr('bc: give me an expression, e.g. echo "2^10" | bc'); return 1; }
    let status = 0;
    for (const e of exprs) {
      if (!e.trim() || e.trim() === 'quit') continue;
      try {
        const v = arith(e, shell.env, { float: true });
        print((Number.isInteger(v) ? String(v) : String(Number(v.toFixed(10)))) + '\n');
      } catch (err) { wErr(`(standard_in) 1: ${err.message}`); status = 1; }
    }
    return status;
  },

  date(args) {
    const d = new Date();
    const fmt = args.find(a => a.startsWith('+'));
    if (fmt) {
      const pad = (n, k = 2) => String(n).padStart(k, '0');
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const map = {
        Y: d.getFullYear(), y: pad(d.getFullYear() % 100), m: pad(d.getMonth() + 1), d: pad(d.getDate()), e: String(d.getDate()).padStart(2),
        H: pad(d.getHours()), M: pad(d.getMinutes()), S: pad(d.getSeconds()), A: days[d.getDay()], a: days[d.getDay()].slice(0, 3),
        B: months[d.getMonth()], b: months[d.getMonth()].slice(0, 3), s: Math.floor(d / 1000), j: pad(Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / 864e5) || 1, 3),
        Z: Intl.DateTimeFormat().resolvedOptions().timeZone, n: '\n', t: '\t', '%': '%',
        F: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, T: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      };
      print(fmt.slice(1).replace(/%(.)/g, (m, c) => map[c] ?? m) + '\n');
      return;
    }
    const [dow, mon, day, year, time] = d.toString().split(' ');
    const tz = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    print(`${dow} ${mon} ${String(Number(day)).padStart(2)} ${time} ${tz} ${year}\n`);
  },

  cal() {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth();
    const title = d.toLocaleString('en-US', { month: 'long' }) + ' ' + y;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    w(esc(title.padStart(10 + Math.ceil(title.length / 2))));
    w('<span style="color:var(--color-text-faint)">Su Mo Tu We Th Fr Sa</span>');
    let row = '   '.repeat(first);
    for (let day = 1; day <= days; day++) {
      const cell = String(day).padStart(2);
      row += day === d.getDate() ? `<span style="background:var(--color-green);color:#04070d">${cell}</span>` : cell;
      row += ' ';
      if ((first + day) % 7 === 0 || day === days) { w(row.trimEnd()); row = ''; }
    }
  },

  uptime() {
    const secs = Math.floor((Date.now() - shell.startedAt) / 1000);
    const t = new Date().toTimeString().slice(0, 5);
    const up = secs < 60 ? `${secs} secs` : secs < 3600 ? `${Math.floor(secs / 60)} mins` : `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}`;
    print(`${t}  up ${up}, 1 user, load averages: 0.42 0.37 0.31\n`);
  },

  hostname() { print('nextcube\n'); },
  id() { print('uid=501(dhairya) gid=20(staff) groups=20(staff),42(research),12(everyone)\n'); },
  groups() { print('staff research everyone\n'); },
  who() { print(`dhairya  ttys001  ${new Date(shell.startedAt).toString().slice(4, 21)}\n`); },
  w() { envCommands.uptime(); print('USER     TTY      FROM    LOGIN@  IDLE WHAT\ndhairya  s001     -       now        - zsh\n'); },

  top() {
    w('<span style="color:var(--color-text-faint)">Processes: 9 total, 5 running · Load Avg: 0.42, 0.37, 0.31 · PhysMem: caffeine used</span>');
    return CMDS.ps([]);
  },

  kill(args) {
    const pid = args.find(a => /^\d+$/.test(a));
    if (!pid) { wErr('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid'); return 2; }
    if (pid === '1') { wErr('kill: kill 1 failed: operation not permitted (init keeps the lights on)'); return 1; }
    wErr(`kill: kill ${pid} failed: operation not permitted — those processes are load-bearing`);
    return 1;
  },

  sudo(args) {
    if (!args.length) { wErr('usage: sudo -h | -K | -k | -V\nusage: sudo [-u user] command'); return 1; }
    print('\nWe trust you have received the usual lecture from the local System\nAdministrator. It usually boils down to these three things:\n\n    #1) Respect the privacy of others.\n    #2) Think before you type.\n    #3) With great power comes great responsibility.\n\n');
    print('[sudo] password for dhairya: \n');
    wErr('dhairya is not in the sudoers file.  This incident will be reported.');
    return 1;
  },

  su() { print('Password: \n'); wErr('su: Sorry'); return 1; },

  exit() {
    w('<span style="color:var(--color-text-faint)">logout</span>');
    w('<span style="color:var(--color-text-faint)">[Process completed]</span>');
    setTimeout(() => { clearScreen(); printBanner(); }, 700);
  },
  logout: () => envCommands.exit(),

  reset() { clearScreen(); printBanner(); },

  curl: netRefusal('curl'),
  wget: netRefusal('wget'),
  ping: netRefusal('ping'),
  ssh(args) { wErr(`ssh: connect to host ${args.find(a => !a.startsWith('-')) || 'nextcube'} port 22: you're already here`); return 255; },

  cowsay(args, ctx) {
    const text = (args.length ? args.join(' ') : (ctx.stdin ?? '').trim()) || 'moo. try: fortune | cowsay';
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const wd of words) { if ((cur + ' ' + wd).trim().length > 38) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); }
    lines.push(cur);
    const width = Math.max(...lines.map(l => l.length));
    const box = lines.length === 1
      ? [`< ${lines[0]} >`]
      : lines.map((l, i) => `${i === 0 ? '/' : i === lines.length - 1 ? '\\' : '|'} ${l.padEnd(width)} ${i === 0 ? '\\' : i === lines.length - 1 ? '/' : '|'}`);
    print([' ' + '_'.repeat(width + 2), ...box, ' ' + '-'.repeat(width + 2),
      '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'].join('\n') + '\n');
  },

  fortune() { print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)] + '\n'); },
};
