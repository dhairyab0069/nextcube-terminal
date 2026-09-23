// The flag table and the localStorage-backed record of which ones are found.
// This is the single source of truth: the terminal commands and the scoreboard
// panel both read from here. Flag 6 is the bonus dungeon flag and does not count
// toward the 5-flag score.

export const REQUIRED_FLAGS = 5;

export const FLAGS = [
  { n: 1, name: 'Binary Strings',       flag: 'FLAG{str1ngs_4r3_y0ur_fr13nd}' },
  { n: 2, name: 'Hidden Files',         flag: 'FLAG{d0tf1l3s_n3v3r_l13}' },
  { n: 3, name: 'Binary Protections',   flag: 'FLAG{ch3cks3c_pr0t3ct10ns}' },
  { n: 4, name: 'Section Headers',      flag: 'FLAG{3lf_s3ct10n_hunt3r}' },
  { n: 5, name: 'Classified Directory', flag: 'FLAG{gh0st_1n_th3_h4l}' },
  { n: 6, name: 'Kernel Dungeon',       flag: 'FLAG{k3rn3l_dungeon_master}', bonus: true },
];

const byFlag = Object.fromEntries(FLAGS.map(f => [f.flag, f]));

export const ctfState = (() => {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('ctf_state') || '{}'); } catch { saved = {}; }
  if (!saved || typeof saved !== 'object') saved = {};
  if (!Array.isArray(saved.found)) saved.found = [];
  return saved;
})();

export function saveCTFState() {
  try { localStorage.setItem('ctf_state', JSON.stringify(ctfState)); } catch {}
}

export const lookupFlag = (flag) => byFlag[flag] || null;
export const isFound = (n) => ctfState.found.includes(n);
export const requiredFound = () => ctfState.found.filter(n => n <= REQUIRED_FLAGS).length;
export const bonusFound = () => ctfState.found.some(n => n > REQUIRED_FLAGS);

// Record a flag string; returns true if this was a new capture. Listeners
// (the scoreboard panel) are notified via a `ctf:update` window event.
export function recordFlag(flag) {
  const entry = lookupFlag(flag);
  if (!entry || isFound(entry.n)) return false;
  ctfState.found.push(entry.n);
  saveCTFState();
  window.dispatchEvent(new CustomEvent('ctf:update', { detail: entry }));
  return true;
}
