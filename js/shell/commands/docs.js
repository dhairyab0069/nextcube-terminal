// One-line docs for every command: drives `help`, `man <cmd>`, `whatis`.
// [category, synopsis, description]

import { w, esc } from '../output.js';

export const CATEGORIES = ['Files', 'Text', 'Shell', 'System', 'CTF & reversing', 'Fun'];

export const DOCS = {
  ls:       ['Files', 'ls [-laAhR1d] [path...]', 'list directory contents (-l long, -a all, -h human sizes, -R recursive)'],
  cd:       ['Files', 'cd [dir | - | ~]', 'change the working directory'],
  pwd:      ['Files', 'pwd', 'print the working directory'],
  cat:      ['Files', 'cat [-n] [file...]', 'print files (or stdin) to stdout'],
  tree:     ['Files', 'tree [-a] [-L depth] [dir]', 'show a directory as a tree'],
  find:     ['Files', 'find [path...] [-name pat] [-iname pat] [-type f|d] [-maxdepth n]', 'search the filesystem'],
  touch:    ['Files', 'touch file...', 'create empty files or update their timestamp'],
  mkdir:    ['Files', 'mkdir [-p] dir...', 'make directories (-p: parents as needed)'],
  rmdir:    ['Files', 'rmdir dir...', 'remove empty directories'],
  rm:       ['Files', 'rm [-rf] path...', 'remove files (-r for directories)'],
  cp:       ['Files', 'cp [-r] src... dest', 'copy files and directories'],
  mv:       ['Files', 'mv src... dest', 'move or rename files'],
  ln:       ['Files', 'ln [-s] target name', 'make links (not supported on this filesystem)'],
  stat:     ['Files', 'stat path...', 'show file metadata'],
  du:       ['Files', 'du [-sh] [path...]', 'estimate disk usage'],
  df:       ['Files', 'df [-h]', 'report filesystem disk space'],
  file:     ['Files', 'file path...', 'identify file type'],
  basename: ['Files', 'basename path [suffix]', 'strip directory (and suffix) from a path'],
  dirname:  ['Files', 'dirname path', 'strip the last component from a path'],
  realpath: ['Files', 'realpath path...', 'print the absolute path'],
  chmod:    ['Files', 'chmod [+x|-x|mode] file...', 'change file mode (+x makes a script runnable)'],
  chown:    ['Files', 'chown owner file...', 'change file owner'],
  nano:     ['Files', 'nano [file]', 'small, friendly text editor (GNU nano style)', [
    'Opens file for editing, creating it on first save if it does not exist.',
    'The two footer lines list the commands; ^ means Ctrl. On a touch',
    'screen, tap them.',
    '',
    '  ^G  F1   help                ^X  F2   exit (asks to save changes)',
    '  ^O  F3   write out (rename)   ^S       save',
    '  ^W  F6   where is (Alt+W)     ^K       cut line (repeat: several)',
    '  ^U       paste                ^C       cursor position',
    '  ^_  ^/   go to line           Tab      two spaces',
    '',
    'Files under ~ and /tmp are writable and saved in this browser; other',
    "files open read-only (title shows View). With text selected, Ctrl+C",
    'and Ctrl+X copy and cut as usual.',
  ]],
  vim:      ['Files', 'vim file', 'nano in a vim costume (^S save, ^X exit; :wq will not work)'],
  vi:       ['Files', 'vi file', 'same as vim'],
  edit:     ['Files', 'edit file', 'same as nano'],
  open:     ['Files', 'open file|url', 'open a link or a file that points to one (try: open resume.pdf)'],
  fsreset:  ['Files', 'fsreset', 'restore the home directory and /tmp to how they shipped'],

  echo:     ['Text', 'echo [-ne] [text...]', 'print arguments (-n no newline, -e escapes)'],
  printf:   ['Text', 'printf format [args...]', 'formatted output (%s %d %f %x %%)'],
  grep:     ['Text', 'grep [-ivnclroEFwh] pattern [file...]', 'search text for a regular expression'],
  head:     ['Text', 'head [-n N] [file...]', 'first lines of input'],
  tail:     ['Text', 'tail [-n N|+N] [file...]', 'last lines of input'],
  wc:       ['Text', 'wc [-lwc] [file...]', 'count lines, words, bytes'],
  sort:     ['Text', 'sort [-rnuf] [-k N] [-t sep] [file...]', 'sort lines'],
  uniq:     ['Text', 'uniq [-cdu] [file]', 'collapse adjacent duplicate lines'],
  cut:      ['Text', 'cut -d sep -f list | -c list [file...]', 'select fields or characters'],
  tr:       ['Text', 'tr [-ds] set1 [set2]', 'translate or delete characters'],
  sed:      ['Text', "sed [-n] [-e] 's/re/rep/g' [file...]", 'stream editor: s///, d, p with line or /re/ addresses'],
  awk:      ['Text', "awk [-F sep] 'program' [file...]", 'pattern scanning: patterns, print, $N, NR, NF, variables, BEGIN/END'],
  rev:      ['Text', 'rev [file...]', 'reverse each line'],
  tac:      ['Text', 'tac [file...]', 'print lines in reverse order'],
  nl:       ['Text', 'nl [file...]', 'number lines'],
  tee:      ['Text', 'tee [-a] file...', 'copy stdin to files and stdout'],
  seq:      ['Text', 'seq [first [step]] last', 'print a sequence of numbers'],
  base64:   ['Text', 'base64 [-d] [file]', 'encode or decode base64'],
  xargs:    ['Text', 'xargs [cmd [args...]]', 'run a command with stdin as arguments'],
  diff:     ['Text', 'diff file1 file2', 'compare files line by line'],
  less:     ['Text', 'less file', 'view a file'],
  more:     ['Text', 'more file', 'view a file'],

  help:     ['Shell', 'help [cmd]', 'list commands, or describe one'],
  man:      ['Shell', 'man page', 'manual pages (try: man dhairya)'],
  whatis:   ['Shell', 'whatis cmd...', 'one-line description of a command'],
  history:  ['Shell', 'history [-c] [N]', 'command history (!! !n !prefix to rerun)'],
  alias:    ['Shell', "alias [name='cmd']", 'define or list aliases'],
  unalias:  ['Shell', 'unalias name...', 'remove aliases'],
  export:   ['Shell', 'export [NAME=value...]', 'set environment variables'],
  unset:    ['Shell', 'unset NAME...', 'remove variables'],
  env:      ['Shell', 'env', 'print the environment'],
  printenv: ['Shell', 'printenv [NAME]', 'print environment variables'],
  type:     ['Shell', 'type name...', 'describe how a name would be interpreted'],
  which:    ['Shell', 'which name...', 'locate a command'],
  source:   ['Shell', 'source file [args]', 'run a file of commands in this shell (also: . sh bash zsh)'],
  expr:     ['Shell', 'expr expression', 'evaluate an integer expression'],
  bc:       ['Shell', 'bc [expression]', 'calculator (reads stdin: echo "2^10" | bc)'],
  true:     ['Shell', 'true', 'succeed'],
  false:    ['Shell', 'false', 'fail'],
  sleep:    ['Shell', 'sleep seconds', 'pretend to wait'],
  clear:    ['Shell', 'clear', 'clear the screen (or Ctrl+L)'],
  reset:    ['Shell', 'reset', 'clear the screen and reprint the banner'],
  exit:     ['Shell', 'exit', 'log out (and straight back in)'],

  whoami:   ['System', 'whoami', 'print the current user'],
  id:       ['System', 'id', 'print user and group ids'],
  groups:   ['System', 'groups', 'print group memberships'],
  who:      ['System', 'who', 'who is logged in'],
  hostname: ['System', 'hostname', 'print the host name'],
  uname:    ['System', 'uname [-a]', 'system information'],
  uptime:   ['System', 'uptime', 'how long this session has been up'],
  date:     ['System', 'date [+format]', 'print the date and time'],
  cal:      ['System', 'cal', 'calendar for this month'],
  ps:       ['System', 'ps [aux]', 'active processes'],
  top:      ['System', 'top', 'process snapshot'],
  kill:     ['System', 'kill pid', 'send a signal to a process'],
  sudo:     ['System', 'sudo cmd', 'run as root (you are not in the sudoers file)'],
  su:       ['System', 'su [user]', 'switch user'],
  fastfetch:['System', 'fastfetch', 'system summary (also: neofetch)'],
  curl:     ['System', 'curl url', 'transfer a URL (no network in here)'],
  wget:     ['System', 'wget url', 'download a URL (no network in here)'],
  ping:     ['System', 'ping host', 'send ICMP echo requests (no network in here)'],

  ctf:      ['CTF & reversing', 'ctf', 'start the 5-flag reverse engineering challenge'],
  hint:     ['CTF & reversing', 'hint [1-5]', 'get a hint for a flag'],
  submit:   ['CTF & reversing', 'submit FLAG{...}', 'submit a flag'],
  scoreboard:['CTF & reversing', 'scoreboard', 'see your progress'],
  strings:  ['CTF & reversing', 'strings file', 'extract printable strings'],
  checksec: ['CTF & reversing', 'checksec file.elf', 'check binary hardening'],
  readelf:  ['CTF & reversing', 'readelf [-hS] file.elf', 'read ELF headers and sections'],
  objdump:  ['CTF & reversing', 'objdump [-d] [-j section] file.elf', 'disassemble or dump sections'],
  xxd:      ['CTF & reversing', 'xxd file', 'hex dump'],

  cowsay:   ['Fun', 'cowsay [text]', 'a talking cow'],
  fortune:  ['Fun', 'fortune', 'a random epigram'],
  flip:     ['Fun', 'flip', 'flip the page (needs cheat mode)'],
  dungeon:  ['Fun', 'dungeon', 'enter the kernel dungeon (needs cheat mode)'],
};

// Print a man page for any documented command; false if there isn't one.
export function manPage(name) {
  const d = DOCS[name];
  if (!d) return false;
  const [cat, synopsis, desc, details] = d;
  const p = `style="color:var(--color-primary)"`;
  const f = `style="color:var(--color-text-faint)"`;
  const t = `style="color:var(--color-text)"`;
  const head = `${name.toUpperCase()}(1)`;
  w(`<span style="color:var(--color-gold)">${esc(head.padEnd(26))}nextcube manual${esc(head.padStart(26))}</span>`);
  w(''); w(`<span ${p}>NAME</span>`);
  w(`       <span ${t}>${esc(name)}</span> <span ${f}>- ${esc(desc)}</span>`);
  w(''); w(`<span ${p}>SYNOPSIS</span>`);
  w(`       <span ${f}>${esc(synopsis)}</span>`);
  if (details) {
    w(''); w(`<span ${p}>DESCRIPTION</span>`);
    details.forEach(l => w(l ? `       <span ${f}>${esc(l)}</span>` : ''));
  }
  w(''); w(`<span ${p}>CATEGORY</span>`);
  w(`       <span ${f}>${esc(cat)}</span>`);
  return true;
}
