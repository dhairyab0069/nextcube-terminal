// nano for the nextcube shell. Takes over the terminal pane with GNU nano's
// layout: title bar, buffer, status line, prompt line and shortcut footer.
//
//   ^G Help   ^O Write Out   ^W Where Is   ^K Cut    ^C Cur Pos
//   ^X Exit   ^S Save        ^U Paste      ^_ Go To Line
//
// The footer entries are buttons, so it works on phones without a Ctrl key.
// Function keys work too (F1 help, F2 exit, F3 write out, F6 where is), and
// Alt+W is an alias for ^W because some browsers reserve Ctrl+W.

import { writeFile } from './fs.js';
import { displayPath, resolvePath, isWritable } from './state.js';

const VERSION = 'GNU nano 7.2';

const terminal = document.getElementById('terminal');
const screenWrap = document.getElementById('screen-wrap');
const shellInput = document.getElementById('terminal-input');

const SHORTCUTS = [
  ['^G', 'Help', 'help'], ['^O', 'Write Out', 'writeOut'], ['^W', 'Where Is', 'whereIs'], ['^K', 'Cut', 'cut'], ['^C', 'Cur Pos', 'curPos'],
  ['^X', 'Exit', 'exit'], ['^S', 'Save', 'save'], ['^U', 'Paste', 'paste'], ['^_', 'Go To Line', 'goTo'],
];
const KEYMAP = { g: 'help', o: 'writeOut', w: 'whereIs', k: 'cut', c: 'curPos', x: 'exit', s: 'save', u: 'paste', _: 'goTo', '/': 'goTo' };
const FKEYS = { F1: 'help', F2: 'exit', F3: 'writeOut', F6: 'whereIs' };

const HELP = `Main nano help text

 nano is a small, friendly editor. Type to insert text; the arrow keys,
 Home/End and the mouse move the cursor. Commands are shown in the two
 lines at the bottom: ^ means Ctrl. Tap them on a touch screen.

 ^G  (F1)   Display this help text
 ^X  (F2)   Close the buffer (asks to save if it was modified)
 ^O  (F3)   Write the buffer to a file (you can change the name)
 ^S         Save the buffer under its current name
 ^W  (F6)   Search forward for a string (also Alt+W); repeat to find next
 ^K         Cut the current line (repeat to cut several into the buffer)
 ^U         Paste the cut buffer at the cursor
 ^C         Show the cursor position
 ^_  (^/)   Go to a line number
 Tab        Insert two spaces
 Ctrl+Z     Undo (browser)

 Files under ~ and /tmp are saved in this browser. Everything else on
 this system is read-only.

 ^X closes this help.`;

let ui = null;
let s = null;   // the open session

function el(tag, cls, attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.assign(e, attrs);
  return e;
}

function build() {
  ui = {};
  ui.root = el('div', 'nano', { hidden: true });
  ui.root.setAttribute('role', 'application');
  ui.root.setAttribute('aria-label', 'nano text editor');
  ui.title = el('div', 'nano-title');
  ui.titleVer = el('span', 'nano-ver');
  ui.titleName = el('span', 'nano-name');
  ui.titleMod = el('span', 'nano-mod');
  ui.title.append(ui.titleVer, ui.titleName, ui.titleMod);
  ui.area = el('textarea', 'nano-area', { spellcheck: false, wrap: 'off' });
  ui.area.setAttribute('autocapitalize', 'off');
  ui.area.setAttribute('autocomplete', 'off');
  ui.area.setAttribute('aria-label', 'File contents');
  ui.help = el('pre', 'nano-help', { hidden: true, tabIndex: -1, textContent: HELP });
  ui.status = el('div', 'nano-status');
  ui.status.setAttribute('role', 'status');
  ui.prompt = el('form', 'nano-prompt', { hidden: true });
  ui.promptLabel = el('label', 'nano-prompt-label');
  ui.promptInput = el('input', 'nano-prompt-input', { autocomplete: 'off', spellcheck: false });
  ui.promptInput.id = 'nano-prompt-input';
  ui.promptLabel.htmlFor = 'nano-prompt-input';
  ui.prompt.append(ui.promptLabel, ui.promptInput);
  ui.foot = el('div', 'nano-foot');
  ui.root.append(ui.title, ui.area, ui.help, ui.status, ui.prompt, ui.foot);
  terminal.appendChild(ui.root);

  ui.area.addEventListener('input', () => { if (!s) return; s.dirty = true; s.cutRun = false; renderTitle(); });
  ui.root.addEventListener('keydown', onKey);
  ui.prompt.addEventListener('submit', (e) => { e.preventDefault(); submitPrompt(); });
  ui.foot.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || !s) return;
    e.preventDefault();
    run(b.dataset.act);
  });
  // Keep the caret in the buffer when footer buttons are tapped.
  ui.foot.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
}

const lines = (t) => t === '' ? 0 : t.split('\n').length - (t.endsWith('\n') ? 1 : 0);

function renderTitle() {
  ui.titleVer.textContent = VERSION;
  ui.titleName.textContent = s.path ? displayPath(s.path) : 'New Buffer';
  ui.titleMod.textContent = s.readOnly ? 'View' : s.dirty ? 'Modified' : '';
}

function renderFoot(items = SHORTCUTS) {
  ui.foot.replaceChildren(...items.map(([k, label, act]) => {
    const b = el('button', 'nano-key', { type: 'button' });
    b.dataset.act = act;
    b.append(el('kbd', '', { textContent: k }), document.createTextNode(' ' + label));
    return b;
  }));
}

function status(msg) { ui.status.textContent = msg ? `[ ${msg} ]` : ''; }

function focusArea() { if (!ui.area.hidden) ui.area.focus(); }

// ── prompts (filename, search, line number, yes/no) ──

function ask(label, value, onSubmit, { yesNo = false } = {}) {
  s.prompt = { onSubmit, yesNo };
  ui.promptLabel.textContent = label;
  ui.promptInput.value = value;
  ui.promptInput.hidden = yesNo;
  ui.prompt.hidden = false;
  status('');
  renderFoot(yesNo
    ? [['Y', 'Yes', 'yes'], ['N', 'No', 'no'], ['^C', 'Cancel', 'cancel']]
    : [['⏎', 'Confirm', 'confirm'], ['^C', 'Cancel', 'cancel']]);
  if (yesNo) { ui.prompt.tabIndex = -1; ui.prompt.focus(); }
  else { ui.promptInput.focus(); ui.promptInput.select(); }
}

function endPrompt() {
  s.prompt = null;
  ui.prompt.hidden = true;
  renderFoot();
  focusArea();
}

function submitPrompt(answer) {
  if (!s?.prompt) return;
  const { onSubmit } = s.prompt;
  const value = answer ?? ui.promptInput.value;
  endPrompt();
  onSubmit(value);
}

function cancelPrompt() { endPrompt(); status('Cancelled'); }

// ── commands ──

function writeTo(name) {
  if (!name) { status('Cancelled'); return false; }
  const path = resolvePath(name);
  let text = ui.area.value;
  if (text && !text.endsWith('\n')) text += '\n';
  try {
    writeFile(path, text);
  } catch (e) {
    status(`Error writing ${name}: ${e.message}`);
    return false;
  }
  s.path = path;
  s.readOnly = false;
  s.dirty = false;
  renderTitle();
  const n = lines(text);
  status(`Wrote ${n} line${n === 1 ? '' : 's'}`);
  return true;
}

const nameOf = () => s.path ? displayPath(s.path) : '';

function lineBounds(pos) {
  const v = ui.area.value;
  const start = v.lastIndexOf('\n', pos - 1) + 1;
  const nl = v.indexOf('\n', pos);
  return [start, nl < 0 ? v.length : nl + 1];
}

function setCaret(pos, end = pos) {
  ui.area.focus();
  ui.area.setSelectionRange(pos, end);
  // Scroll the caret into view: textarea only does this on input, so nudge it.
  const before = ui.area.value.slice(0, pos);
  const row = before.split('\n').length - 1;
  const lh = parseFloat(getComputedStyle(ui.area).lineHeight) || 18;
  const top = row * lh;
  if (top < ui.area.scrollTop || top > ui.area.scrollTop + ui.area.clientHeight - lh * 2) ui.area.scrollTop = Math.max(0, top - ui.area.clientHeight / 3);
}

const actions = {
  help() {
    s.inHelp = true;
    ui.area.hidden = true;
    ui.help.hidden = false;
    ui.help.scrollTop = 0;
    ui.help.focus();
    renderFoot([['^X', 'Close', 'closeHelp'], ['F1', 'Close', 'closeHelp']]);
    status('');
  },
  closeHelp() {
    s.inHelp = false;
    ui.help.hidden = true;
    ui.area.hidden = false;
    renderFoot();
    focusArea();
  },
  save() {
    if (!s.path) return actions.writeOut();
    writeTo(nameOf());
  },
  writeOut() {
    ask('File Name to Write: ', nameOf(), (v) => writeTo(v.trim()));
  },
  exit() {
    if (!s.dirty) return close();
    ask('Save modified buffer?  ', '', (ans) => {
      if (ans === 'no') return close();
      if (s.path && !s.readOnly) { if (writeTo(nameOf())) close(); return; }
      ask('File Name to Write: ', nameOf(), (v) => { if (writeTo(v.trim())) close(); });
    }, { yesNo: true });
  },
  cut() {
    const v = ui.area.value;
    const [a, b] = lineBounds(ui.area.selectionStart);
    if (a === b && a === v.length) { status('Nothing was cut'); return; }
    let chunk = v.slice(a, b);
    if (!chunk.endsWith('\n')) chunk += '\n';
    s.cutBuf = s.cutRun ? s.cutBuf + chunk : chunk;
    ui.area.setRangeText('', a, b, 'start');
    ui.area.setSelectionRange(a, a);
    s.dirty = true;
    renderTitle();
    s.cutRun = true;
    status('');
  },
  paste() {
    if (!s.cutBuf) { status('Cutbuffer is empty'); return; }
    const pos = ui.area.selectionStart;
    ui.area.setRangeText(s.cutBuf, pos, ui.area.selectionEnd, 'end');
    s.dirty = true;
    renderTitle();
    status('');
  },
  whereIs() {
    ask(`Search${s.lastSearch ? ` [${s.lastSearch}]` : ''}: `, '', (q) => {
      q = q || s.lastSearch;
      if (!q) { status('Cancelled'); return; }
      s.lastSearch = q;
      const v = ui.area.value;
      const from = ui.area.selectionEnd;
      let i = v.indexOf(q, from);
      let wrapped = false;
      if (i < 0) { i = v.indexOf(q); wrapped = i >= 0; }
      if (i < 0) { status(`"${q}" not found`); return; }
      setCaret(i, i + q.length);
      status(wrapped ? 'Search Wrapped' : '');
    });
  },
  goTo() {
    ask('Enter line number, column number: ', '', (v) => {
      const [ln, col] = v.split(/[ ,]+/).map(Number);
      if (!ln) { status('Invalid line or column number'); return; }
      const all = ui.area.value.split('\n');
      const line = Math.min(Math.max(1, ln), all.length);
      let pos = all.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
      pos += Math.min(Math.max(0, (col || 1) - 1), all[line - 1].length);
      setCaret(pos);
    });
  },
  curPos() {
    const v = ui.area.value;
    const pos = ui.area.selectionStart;
    const all = v.split('\n');
    const row = v.slice(0, pos).split('\n').length;
    const col = pos - (v.lastIndexOf('\n', pos - 1) + 1) + 1;
    const lineLen = all[row - 1].length + 1;
    const pct = (a, b) => Math.round((a / Math.max(1, b)) * 100);
    status(`line ${row}/${all.length} (${pct(row, all.length)}%), col ${col}/${lineLen} (${pct(col, lineLen)}%), char ${pos + 1}/${v.length + 1} (${pct(pos + 1, v.length + 1)}%)`);
  },
  yes() { submitPrompt('yes'); },
  no() { submitPrompt('no'); },
  confirm() { submitPrompt(); },
  cancel() { cancelPrompt(); },
};

function run(act) {
  if (act !== 'cut') s.cutRun = false;
  actions[act]?.();
}

function onKey(e) {
  if (!s) return;
  const ctrl = e.ctrlKey && !e.altKey;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (s.prompt) {
    if ((ctrl && k === 'c') || k === 'Escape') { e.preventDefault(); cancelPrompt(); return; }
    if (s.prompt.yesNo) {
      if (k === 'y' || k === 'n') { e.preventDefault(); submitPrompt(k === 'y' ? 'yes' : 'no'); }
      else if (k !== 'Tab') e.preventDefault();
    }
    return;   // filename / search input handles its own typing and Enter
  }

  if (s.inHelp) {
    if ((ctrl && k === 'x') || k === 'Escape' || k === 'q' || k === 'F1') { e.preventDefault(); actions.closeHelp(); }
    return;
  }

  // With text selected, let Ctrl+C / Ctrl+X copy and cut as usual.
  const selected = ui.area.selectionStart !== ui.area.selectionEnd;
  if (ctrl && (k === 'c' || k === 'x') && selected) return;
  let act = null;
  if (ctrl && KEYMAP[k]) act = KEYMAP[k];
  else if ((e.metaKey && k === 's')) act = 'save';
  else if (e.altKey && k === 'w') act = 'whereIs';
  else if (FKEYS[e.key]) act = FKEYS[e.key];
  else if (k === 'Escape') act = 'exit';
  if (act) { e.preventDefault(); run(act); return; }

  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    ui.area.setRangeText('  ', ui.area.selectionStart, ui.area.selectionEnd, 'end');
    s.dirty = true; renderTitle();
    return;
  }
  if (!e.ctrlKey && !e.metaKey) s.cutRun = false;
}

function close() {
  const done = s.onClose;
  s = null;
  ui.root.hidden = true;
  screenWrap.hidden = false;
  shellInput.focus();
  done?.();
}

// Open `path` (array) with `content`. `exists` false shows "[ New File ]".
export function openEditor(path, content, { flavour = 'nano', exists = true, readOnly = !isWritable(path), onClose } = {}) {
  if (!ui) build();
  s = { path, dirty: false, readOnly, onClose, cutBuf: s?.cutBuf ?? '', cutRun: false, prompt: null, inHelp: false, lastSearch: '' };
  ui.area.value = content;
  ui.area.hidden = false;
  ui.help.hidden = true;
  ui.prompt.hidden = true;
  renderTitle();
  renderFoot();
  const n = lines(content);
  if (flavour === 'vim') status(`vim is nano in disguise here: ^X exits, ^S saves (:wq won't work)`);
  else if (readOnly) status(`File '${displayPath(path)}' is unwritable`);
  else status(exists ? `Read ${n} line${n === 1 ? '' : 's'}` : 'New File');
  screenWrap.hidden = true;
  ui.root.hidden = false;
  ui.area.focus();
  ui.area.setSelectionRange(0, 0);
  ui.area.scrollTop = 0;
}

export const editorOpen = () => !!s;
