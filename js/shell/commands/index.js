// The shell's command table, assembled from the per-topic groups.
// Key = command name as typed; value = (args) => void.

import { helpCommands } from './help.js';
import { filesystemCommands } from './filesystem.js';
import { systemCommands } from './system.js';
import { binaryCommands } from './binary.js';
import { ctfCommands } from './ctf.js';
import { easterEggCommands } from './easter-eggs.js';

export const CMDS = {
  ...helpCommands,
  ...filesystemCommands,
  ...systemCommands,
  ...binaryCommands,
  ...ctfCommands,
  ...easterEggCommands
};
