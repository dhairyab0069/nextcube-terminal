// Everything that writes into the terminal's output pane.
//
// Output can be captured: pipes, `>` redirects and $(...) push a capture
// buffer, and while one is active w()/wPre()/print() append plain text to it
// instead of the screen. That lets the HTML-writing commands work in
// pipelines unchanged. wErr() is stderr: it goes to the screen unless a
// `2>` redirect captured it.

export const output = document.getElementById('terminal-output');
const screenWrap = document.getElementById('screen-wrap');

const captures = [];     // stdout buffers, innermost last
const errCaptures = [];  // stderr buffers (may alias a stdout buffer for 2>&1)
let errored = false;     // did the running command write to stderr?

export const capturing = () => captures.length > 0;
export function startCapture() { captures.push([]); }
export function endCapture() { return captures.pop().join(''); }
export function startErrCapture(mergeWithStdout = false) {
  errCaptures.push(mergeWithStdout && captures.length ? captures[captures.length - 1] : []);
}
export function endErrCapture() { return errCaptures.pop().join(''); }
export function takeErrored() { const e = errored; errored = false; return e; }

// After a command runs, the REPL scrolls to the newest line unless a command
// pinned an earlier element (fastfetch pins its header so the art stays in view).
let scrollPin = null;
export function pinScroll(el) { scrollPin = el; }
export function settleScroll() {
  if (scrollPin?.isConnected) screenWrap.scrollTop += scrollPin.getBoundingClientRect().top - screenWrap.getBoundingClientRect().top;
  else screenWrap.scrollTop = screenWrap.scrollHeight;
  scrollPin = null;
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const scratch = document.createElement('div');
function htmlToText(html) {
  scratch.innerHTML = html;
  return scratch.textContent;
}

// Append a line of pre-built HTML.
export function w(html) {
  const d = document.createElement('div');
  if (captures.length) { captures[captures.length - 1].push(htmlToText(html) + '\n'); return d; }
  d.innerHTML = html;
  output.appendChild(d);
  return d;
}

// Append preformatted plain text (file contents, ASCII art).
export function wPre(text) {
  text = String(text);
  if (text === '') return;
  if (captures.length) { captures[captures.length - 1].push(text.endsWith('\n') ? text : text + '\n'); return; }
  const d = document.createElement('div');
  d.style.whiteSpace = 'pre';
  d.style.fontFamily = 'inherit';
  d.textContent = text.endsWith('\n') ? text.slice(0, -1) : text;
  output.appendChild(d);
}

// Write raw stdout text exactly (no newline added), for text-processing
// commands. On screen a trailing newline is dropped, and "\n" alone is a
// blank line.
export function print(text) {
  text = String(text);
  if (text === '') return;
  if (captures.length) { captures[captures.length - 1].push(text); return; }
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (body === '') { w(''); return; }
  const d = document.createElement('div');
  d.style.whiteSpace = 'pre';
  d.textContent = body;
  output.appendChild(d);
}

export function wErr(msg) {
  errored = true;
  if (errCaptures.length) { errCaptures[errCaptures.length - 1].push(msg + '\n'); return; }
  const d = document.createElement('div');
  d.innerHTML = `<span style="color:var(--color-magenta)">${esc(msg)}</span>`;
  output.appendChild(d);
}

export function clearScreen() {
  if (!captures.length) output.innerHTML = '';
}

export function dirSpan(name) {
  return `<span style="color:var(--color-primary);font-weight:600">${esc(name)}/</span>`;
}

export function fileSpan(name) {
  return `<span style="color:var(--color-text)">${esc(name)}</span>`;
}

export function execSpan(name) {
  return `<span style="color:var(--color-green)">${esc(name)}*</span>`;
}
