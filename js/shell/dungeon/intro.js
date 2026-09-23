// Title card, premise and instructions printed when the dungeon starts.

import { w } from '../output.js';

export function printDungeonIntro() {
    const g = `style="color:var(--color-gold)"`;
    const gr = `style="color:var(--color-green)"`;
    const f = `style="color:var(--color-text-faint)"`;
    const p = `style="color:var(--color-primary)"`;
    const m = `style="color:var(--color-magenta)"`;
    w(`<span ${g}>╔══════════════════════════════════════╗</span>`);
    w(`<span ${g}>║        THE KERNEL DUNGEON  v0.1      ║</span>`);
    w(`<span ${g}>╚══════════════════════════════════════╝</span>`);
    w(``);
    w(`<span ${f}>The kingdom of Nexcube has fallen silent.</span>`);
    w(`<span ${f}>A dark force — the Race Condition — has seized the throne, splitting</span>`);
    w(`<span ${f}>reality into fragments. Only the Sudo Token, hidden deep within</span>`);
    w(`<span ${f}>the castle, can end its reign.</span>`);
    w(`<span ${f}>You are the last one willing to go in.</span>`);
    w(``);
    w(`<span ${p}>── HOW TO PLAY ─────────────────────────────────</span>`);
    w(`  <span ${gr}>look</span>            <span ${f}>describe your current room</span>`);
    w(`  <span ${gr}>go north</span>        <span ${f}>(or south / east / west) — move between rooms</span>`);
    w(`  <span ${gr}>take rusty pointer</span>  <span ${f}>pick up an item (use its name)</span>`);
    w(`  <span ${gr}>use health potion</span>   <span ${f}>use an item from your inventory</span>`);
    w(`  <span ${gr}>attack</span>          <span ${f}>fight the enemy in this room</span>`);
    w(`  <span ${gr}>inventory</span>       <span ${f}>see what you're carrying</span>`);
    w(`  <span ${gr}>status</span>          <span ${f}>check your HP</span>`);
    w(`  <span ${gr}>quit</span>            <span ${f}>exit the dungeon</span>`);
    w(``);
    w(`<span ${p}>── TIPS ────────────────────────────────────────</span>`);
    w(`  <span ${f}>• You can't move through a room with a living enemy — defeat it first.</span>`);
    w(`  <span ${f}>• Pick up every item you find — you'll need them.</span>`);
    w(`  <span ${f}>• The final boss requires a special item to beat.</span>`);
    w(`  <span ${f}>• Type <span ${gr}>look</span> any time to remind yourself where you are.</span>`);
    w(``);
    w(`<span ${m}>You stand at the Castle Gates. Good luck.</span>`);
    w(``);
}
