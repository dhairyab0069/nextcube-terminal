// Mounts ~/publications/<id>.txt and <id>.bib from the main site's
// /data/publications.json (same origin in production). If the file isn't
// reachable (e.g. local dev of this repo alone) the directory is just absent.
//
// NOTE: toBibtex mirrors js/publications.js in the main site repo; keep the
// two in sync if the BibTeX format changes.

import { VFS } from './shell/vfs.js';

const DATA_URL = '/data/publications.json';

const bibName = (name, overrides = {}) => {
  if (overrides[name]) return overrides[name];
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts.pop()}, ${parts.join(' ')}`;
};

export function toBibtex(p) {
  const surname = p.authors[0].trim().split(/\s+/).pop().toLowerCase();
  const key = `${surname}${p.year}${p.id}`;
  const fields = [
    ['title', `{${p.title}}`],
    ['author', `{${p.authors.map(a => bibName(a, p.bibNames)).join(' and ')}}`],
    ['year', `{${p.year}}`],
  ];
  if (p.arxiv) fields.push(['journal', `{arXiv preprint arXiv:${p.arxiv}}`], ['eprint', `{${p.arxiv}}`], ['archivePrefix', '{arXiv}']);
  else if (p.venue) fields.push(['booktitle', `{${p.venue}}`]);
  return `@article{${key},\n${fields.map(([k, v]) => `  ${k} = ${v}`).join(',\n')}\n}`;
}

export async function mountPublications() {
  let data;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    data = await res.json();
  } catch { return; }
  const entries = {};
  for (const p of data.publications || []) {
    const body = [
      p.title,
      '',
      p.authors.join(', '),
      [p.venue, p.arxiv && `arXiv:${p.arxiv}`, p.year].filter(Boolean).join(' · '),
      [p.role, p.status].filter(Boolean).join(' · '),
      '',
      p.summary || '',
      '',
      ...Object.entries(p.links || {}).map(([k, v]) => `${k.padEnd(6)} ${v}`),
    ].join('\n');
    entries[`${p.id}.txt`] = { type: 'file', size: body.length, modified: 'Sep  8 2026', content: body };
    const bib = toBibtex(p);
    entries[`${p.id}.bib`] = { type: 'file', size: bib.length, modified: 'Sep  8 2026', content: bib };
  }
  VFS.entries.publications = { type: 'dir', modified: 'Sep  8 2026', entries };
}
