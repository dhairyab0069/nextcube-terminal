// The shell's command table, assembled from the per-topic groups.
// Key = command name as typed; value = (args, ctx) => status | void.
// Every command also appears as an executable in /bin.

import { VFS } from '../vfs.js';
import { helpCommands } from './help.js';
import { filesystemCommands } from './filesystem.js';
import { fileopsCommands } from './fileops.js';
import { textCommands } from './text.js';
import { envCommands } from './env.js';
import { systemCommands } from './system.js';
import { binaryCommands } from './binary.js';
import { ctfCommands } from './ctf.js';
import { easterEggCommands } from './easter-eggs.js';

export const CMDS = {
  ...helpCommands,
  ...filesystemCommands,
  ...fileopsCommands,
  ...textCommands,
  ...envCommands,
  ...systemCommands,
  ...binaryCommands,
  ...ctfCommands,
  ...easterEggCommands
};

// Builtins that only make sense inside the shell process don't get a binary.
const SHELL_ONLY = new Set(['cd', 'export', 'unset', 'alias', 'unalias', 'source', '.', 'history', 'exit', 'logout', 'set', 'type']);
for (const name of Object.keys(CMDS)) {
  if (SHELL_ONLY.has(name)) continue;
  const size = 16384 + [...name].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) % 90000;
  VFS.entries.bin.entries[name] = { type: 'file', exec: true, size, modified: 'Sep  1 2025', content: `\u007fELF\u0002\u0001\u0001 ${name}: binary file (run it: ${name})` };
}
