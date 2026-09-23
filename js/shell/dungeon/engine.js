// The dungeon command loop. While `window._dgMode` is set, the shell routes
// every line here instead of to the normal command table.

import { output, w, esc } from '../output.js';

function dgRoom()  { return window._dg.rooms[window._dg.room]; }
function dgEnemy() {
  const r = dgRoom();
  if (!r.enemy || window._dg.defeated.has(r.enemy)) return null;
  return { key: r.enemy, ...window._dg.enemies[r.enemy] };
}
function dgHpBar(cur, max) {
  const filled = Math.max(0, Math.min(10, Math.round((cur/max)*10)));
  return '█'.repeat(filled) + '░'.repeat(10-filled) + ` ${cur}/${max}`;
}
export function dgLook() {
  const dg = window._dg;
  const r = dgRoom();
  const en = dgEnemy();
  const g = `style="color:var(--color-gold)"`;
  const p = `style="color:var(--color-primary)"`;
  const m = `style="color:var(--color-magenta)"`;
  const f = `style="color:var(--color-text-faint)"`;
  w(`<span ${g}>${esc(r.name)}</span>`);
  w(`<span ${f}>${esc(r.desc||'')}</span>`);
  const liveItems = (r.items||[]).filter(i => !dg.taken.has(i));
  if (liveItems.length) w(`<span ${f}>Items here: <span ${p}>${liveItems.map(i=>dg.items[i].name).join(', ')}</span></span>`);
  const exits = Object.keys(r.exits||{});
  w(`<span ${f}>Exits: <span style="color:var(--color-green)">${exits.join(', ')}</span></span>`);
  if (en) w(`<span ${m}>⚠ ${esc(en.name)} is here! [HP: ${dgHpBar(dg.eHp[en.key], en.maxHp)}]</span>`);
}
export function dgCmd(line) {
  const dg = window._dg;
  const [cmd, ...rest] = line.trim().toLowerCase().split(/\s+/);
  const arg = rest.join(' ');
  const g  = `style="color:var(--color-gold)"`;
  const gr = `style="color:var(--color-green)"`;
  const m  = `style="color:var(--color-magenta)"`;
  const f  = `style="color:var(--color-text-faint)"`;
  const p  = `style="color:var(--color-primary)"`;
  w(`<span style="color:var(--color-green)">dungeon</span><span style="color:var(--color-text-faint)">></span> <span style="color:var(--color-text)">${esc(line)}</span>`);
  if (cmd==='quit'||cmd==='exit') {
    dg.active=false; window._dgMode=false;
    w(`<span ${f}>Exiting dungeon.</span>`); return;
  }
  if (cmd==='clear') { output.innerHTML=''; return; }
  if (cmd==='look') { dgLook(); return; }
  if (cmd==='inventory'||cmd==='inv') {
    if (!dg.inventory.length) { w(`<span ${f}>Inventory empty.</span>`); return; }
    dg.inventory.forEach(i => w(`<span ${p}>${esc(dg.items[i].name)}</span> <span ${f}>— ${esc(dg.items[i].desc)}</span>`));
    return;
  }
  if (cmd==='status') {
    w(`<span ${gr}>HP: ${dgHpBar(dg.hp, dg.maxHp)}</span>`);
    w(`<span ${f}>Room: ${esc(dgRoom().name)}</span>`); return;
  }
  if (cmd==='go') {
    const r=dgRoom(); const en=dgEnemy();
    if (en) { w(`<span ${m}>${esc(en.name)} blocks your path. Defeat it first.</span>`); return; }
    if (!r.exits||!r.exits[arg]) { w(`<span ${m}>Can't go ${esc(arg||'?')} from here.</span>`); return; }
    dg.room=r.exits[arg]; dgLook(); return;
  }
  if (cmd==='take'||cmd==='pick'||cmd==='get') {
    const r=dgRoom();
    const available=(r.items||[]).filter(i=>!dg.taken.has(i));
    const key = arg
      ? Object.keys(dg.items).find(k=>dg.items[k].name.toLowerCase().includes(arg)&&available.includes(k))
      : available[0];
    if (!key) { w(`<span ${m}>${available.length?'No such item here.':'Nothing to take here.'}</span>`); return; }
    dg.inventory.push(key);
    dg.taken.add(key);
    w(`<span ${gr}>Took ${esc(dg.items[key].name)}.</span>`); return;
  }
  if (cmd==='use') {
    const key=dg.inventory.find(k=>dg.items[k].name.toLowerCase().includes(arg));
    if (!arg) {
      if (!dg.inventory.length) { w(`<span ${f}>Inventory empty.</span>`); return; }
      w(`<span ${f}>Use what? You have: <span style="color:var(--color-primary)">${dg.inventory.map(i=>dg.items[i].name).join(', ')}</span></span>`);
      return;
    }
    if (!key) { w(`<span ${m}>You don't have that.</span>`); return; }
    if (key==='health_potion') {
      const gained=Math.min(5,dg.maxHp-dg.hp); dg.hp=Math.min(dg.maxHp,dg.hp+5);
      dg.inventory=dg.inventory.filter(i=>i!=='health_potion');
      w(`<span ${gr}>Drank the elixir. +${gained} HP. [${dgHpBar(dg.hp,dg.maxHp)}]</span>`);
    } else if (key==='sudo_token') {
      const en=dgEnemy();
      if (!en) { w(`<span ${f}>No enemy here to use it on.</span>`); return; }
      if (!en.sudo) { w(`<span ${f}>The Sudo Seal hums, but this enemy does not yield to authority.</span>`); return; }
      // Treat as an attack with guaranteed sudo bonus
      const pdmg = 3 + 8 + Math.floor(Math.random()*2);
      dg.eHp[en.key]=Math.max(0,dg.eHp[en.key]-pdmg);
      w(`<span ${g}>The Sudo Seal blazes with light. SUDO OVERRIDE — ${pdmg} damage!</span>`);
      w(`<span ${gr}>[Enemy HP: ${dgHpBar(dg.eHp[en.key],en.maxHp)}]</span>`);
      if (dg.eHp[en.key]<=0) {
        dg.defeated.add(en.key);
        w(`<span ${g}>✓ ${esc(en.name)} defeated!</span>`);
        dg.won=true; window._dgMode=false; dg.active=false;
        w(``); w(`<span ${g}>╔═════════════════════════════════════╗</span>`);
        w(`<span ${g}>║      YOU WIN. KINGDOM RESTORED.     ║</span>`);
        w(`<span ${g}>╚═════════════════════════════════════╝</span>`);
        w(`<span ${f}>The throne shatters. Something falls to the floor...</span>`); w(``);
        w(`<span style="color:var(--color-gold);font-weight:600">FLAG{k3rn3l_dungeon_master}</span>`); w(``);
        w(`<span ${f}>Type <span style="color:var(--color-green)">submit FLAG{k3rn3l_dungeon_master}</span> to claim the bonus flag.</span>`);
        return;
      }
      // Enemy fights back
      const edmg=Math.max(1,en.dmg+Math.floor(Math.random()*2)-1);
      dg.hp=Math.max(0,dg.hp-edmg);
      w(`<span ${m}>${esc(en.name)} retaliates for ${edmg}. [Your HP: ${dgHpBar(dg.hp,dg.maxHp)}]</span>`);
      if (dg.hp<=0) {
        dg.active=false; window._dgMode=false;
        w(``); w(`<span ${m}>You died. The kingdom falls.</span>`);
        w(`<span ${f}>Type <span style="color:var(--color-green)">dungeon</span> to try again.</span>`);
      }
    } else { w(`<span ${f}>Can't use that here.</span>`); }
    return;
  }
  if (cmd==='attack') {
    const en=dgEnemy();
    if (!en) { w(`<span ${f}>Nothing to attack.</span>`); return; }
    const hasSword=dg.inventory.includes('rusty_pointer');
    const hasSudo=dg.inventory.includes('sudo_token');
    let pdmg=hasSword?3:1;
    if (en.sudo&&hasSudo) { pdmg+=8; w(`<span ${gr}>SUDO OVERRIDE — critical hit!</span>`); }
    pdmg+=Math.floor(Math.random()*2);
    dg.eHp[en.key]=Math.max(0,dg.eHp[en.key]-pdmg);
    w(`<span ${gr}>You hit ${esc(en.name)} for ${pdmg}. [Enemy HP: ${dgHpBar(dg.eHp[en.key],en.maxHp)}]</span>`);
    if (dg.eHp[en.key]<=0) {
      dg.defeated.add(en.key);
      w(`<span ${g}>✓ ${esc(en.name)} defeated!</span>`);
      if (en.key==='race_condition') {
        dg.won=true; window._dgMode=false; dg.active=false;
        w(``); w(`<span ${g}>╔═════════════════════════════════════╗</span>`);
        w(`<span ${g}>║      YOU WIN. KERNEL CLEARED.       ║</span>`);
        w(`<span ${g}>╚═════════════════════════════════════╝</span>`);
        w(`<span ${f}>The daemon dissolves and drops something...</span>`); w(``);
        w(`<span style="color:var(--color-gold);font-weight:600">FLAG{k3rn3l_dungeon_master}</span>`); w(``);
        w(`<span ${f}>Type <span style="color:var(--color-green)">submit FLAG{k3rn3l_dungeon_master}</span> to claim the bonus flag.</span>`);
      }
      return;
    }
    const edmg=Math.max(1,en.dmg+Math.floor(Math.random()*2)-1);
    dg.hp=Math.max(0,dg.hp-edmg);
    w(`<span ${m}>${esc(en.name)} hits you for ${edmg}. [Your HP: ${dgHpBar(dg.hp,dg.maxHp)}]</span>`);
    if (dg.hp<=0) {
      dg.active=false; window._dgMode=false;
      w(``); w(`<span ${m}>You died. Kernel panic.</span>`);
      w(`<span ${f}>Type <span style="color:var(--color-green)">dungeon</span> to try again.</span>`);
    }
    return;
  }
  w(`<span ${f}>Unknown command. Try: look  go [dir]  take [item]  use [item]  attack  inventory  status  quit</span>`);
}
