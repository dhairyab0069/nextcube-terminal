// The Kernel Dungeon world: rooms, items and bestiary. Pure data.
// `createDungeonState()` returns a fresh run so replays start clean.

export function createDungeonState() {
  const state = {
    active: true, room: 'boot', hp: 10, maxHp: 10,
    inventory: [], taken: new Set(), defeated: new Set(), won: false,
    rooms: {
      boot:   { name:'Castle Gates',      exits:{east:'heap',south:'stack'},  items:['rusty_pointer'], enemy:null, desc:'Crumbling stone archways flicker with dying torchlight. The air smells of ash.' },
      heap:   { name:'The Vaulted Hall',   exits:{west:'boot',south:'kernel'}, items:[],               enemy:'memory_leak', desc:'A grand hall, now ruined. Something stirs in the rubble.' },
      stack:  { name:'The Armoury',        exits:{north:'boot',east:'kernel'}, items:['health_potion'], enemy:'segfault', desc:'Weapon racks line the walls. A potion sits forgotten on a shelf.' },
      kernel: { name:'The Inner Sanctum',  exits:{north:'heap',west:'stack',south:'void'}, items:['sudo_token'], enemy:null, desc:'A circular chamber. Ancient runes cover the floor. Something gleams at the centre.' },
      void:   { name:'The Throne Room',    exits:{north:'kernel'},             items:[],               enemy:'race_condition', desc:'The air warps and flickers. On the throne sits the Race Condition, waiting.' },
    },
    items: {
      rusty_pointer:  { name:'Rusty Blade',    desc:'An old sword. Unreliable but sharp enough.', damage:3 },
      health_potion:  { name:'Elixir',         desc:'A glowing vial. Restores 5 HP.' },
      sudo_token:     { name:'Sudo Seal',      desc:'An ancient seal of authority. The throne room will yield to it.' },
    },
    enemies: {
      memory_leak:    { name:'Wraith of Forgotten Things', hp:6,  maxHp:6,  dmg:2, sudo:false },
      segfault:       { name:'The Segfault Knight', hp:8,  maxHp:8,  dmg:3, sudo:false },
      race_condition: { name:'The Race Condition', hp:15, maxHp:15, dmg:5, sudo:true  },
    },
    eHp: {},
  };
  // Enemy HP is tracked separately so `enemies` stays a static template.
  for (const [k, v] of Object.entries(state.enemies)) state.eHp[k] = v.hp;
  return state;
}
