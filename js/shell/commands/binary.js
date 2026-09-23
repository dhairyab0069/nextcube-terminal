// Simulated reverse-engineering toolchain. These are the CTF workhorses:
// each one leaks a different flag depending on the file it is pointed at.

import { w, wErr, wPre, esc } from '../output.js';
import { getNode, resolvePath } from '../state.js';

export const binaryCommands = {
  strings(args) {
    const target = args[0];
    if (!target) { wErr('strings: missing operand'); return; }
    const p = resolvePath(target);
    const node = getNode(p);
    if (!node) { wErr(`strings: ${target}: No such file or directory`); return; }
    if (node.type === 'dir') { wErr(`strings: ${target}: Is a directory`); return; }
    const name = p[p.length - 1] || '';
    if (name === 'resume.pdf' || target.includes('resume')) {
      const lines = [
        '/usr/lib/libpdf.so.2','/lib/x86_64-linux-gnu/libc.so.6',
        'GCC: (Ubuntu 11.4.0) 11.4.0','PDF-1.4','Helvetica-Bold',
        'bhatiadhairya19@gmail.com','Northeastern University',
        'Khoury College of Computer Science','Master of Science',
        'CACTILab','Northeastern University',
        '__libc_start_main','_IO_puts','malloc','free',
        '.text','.rodata','.data','.bss',
        'LLM-Assisted Hardware Abstraction Layer (HAL) Generation',
        'cargo test -- --nocapture',
        '/home/dhairya/research/cactilab',
        'FLAG{str1ngs_4r3_y0ur_fr13nd}',
        'embedded-hal = "1.0"','no_std',
        'typestate pattern','PhantomData',
        '/tmp/.X0-lock','_start','atexit',
      ];
      w(`<span style="color:var(--color-text-faint)">Scanning ${esc(target)} for printable strings (min 4)...</span>`);
      lines.forEach(l => {
        const isFlag = l.startsWith('FLAG{');
        w(`<span style="${isFlag ? 'color:var(--color-gold);font-weight:600' : 'color:var(--color-text-faint)'}">${esc(l)}</span>`);
      });
    } else if (name.endsWith('.elf')) {
      const lines = [
        'GCC: (arm-none-eabi 12.2.0)','_start','Reset_Handler',
        'SystemInit','main','gpio_init','gpio_set_high','gpio_set_low',
        'DL_GPIO_setPins','DL_GPIO_clearPins','DL_GPIO_readPins',
        '.text','.rodata','.bss','.data','.flag',
        'embedded-hal','no_std',
        'PA0_PIN','PB0_PIN','PC0_PIN','GPIOA','GPIOB','GPIOC',
        'unsafe { (*GPIOA::ptr()).dout31_0.write(|w| w.bits(val)) }',
      ];
      w(`<span style="color:var(--color-text-faint)">Scanning ${esc(name)} for printable strings...</span>`);
      lines.forEach(l => w(`<span style="color:var(--color-text-faint)">${esc(l)}</span>`));
    } else {
      w(`<span style="color:var(--color-text-faint)">Scanning ${esc(target)}...</span>`);
      wPre(node.content);
    }
  },

  checksec(args) {
    const target = args[0];
    if (!target) { wErr('checksec: missing target\nUsage: checksec <elf-file>'); return; }
    const p = resolvePath(target);
    const node = getNode(p);
    if (!node) { wErr(`checksec: ${target}: No such file or directory`); return; }
    const name = p[p.length-1] || '';
    if (!name.endsWith('.elf')) { wErr(`checksec: ${target}: not an ELF binary`); return; }
    const g = `style="color:var(--color-green)"`;
    const r = `style="color:var(--color-magenta)"`;
    const f = `style="color:var(--color-text-faint)"`;
    const y = `style="color:var(--color-gold)"`;
    w(`<span ${f}>RELRO           STACK CANARY    NX              PIE             RPATH      RUNPATH    Symbols         FORTIFY  FILE</span>`);
    if (name === 'hal_gpio.elf') {
      w(`<span ${g}>Full RELRO</span>      <span ${g}>Canary found</span>    <span ${g}>NX enabled</span>      <span ${g}>PIE enabled</span>     <span ${g}>No RPATH</span>   <span ${g}>No RUNPATH</span> <span ${r}>FLAG{ch3cks3c_pr0t3ct10ns}</span>   <span ${g}>Yes</span>      <span ${f}>${esc(name)}</span>`);
    } else {
      w(`<span ${g}>Partial RELRO</span>   <span ${r}>No canary</span>       <span ${g}>NX enabled</span>      <span ${r}>No PIE</span>          <span ${g}>No RPATH</span>   <span ${g}>No RUNPATH</span> <span ${f}>No symbols</span>       <span ${r}>No</span>       <span ${f}>${esc(name)}</span>`);
    }
  },

  readelf(args) {
    const target = args.find(a => !a.startsWith('-'));
    if (!target) { wErr('readelf: missing operand'); return; }
    const p = resolvePath(target);
    const node = getNode(p);
    if (!node) { wErr(`readelf: ${target}: No such file or directory`); return; }
    const name = p[p.length-1] || '';
    if (!name.endsWith('.elf')) { wErr(`readelf: ${target}: not an ELF file`); return; }
    const f = `style="color:var(--color-text-faint)"`;
    const p2 = `style="color:var(--color-primary)"`;
    const y = `style="color:var(--color-gold)"`;
    w(`<span ${f}>ELF Header:</span>`);
    w(`<span ${f}>  Magic:   7f 45 4c 46 02 01 01 00  00 00 00 00 00 00 00 00</span>`);
    w(`<span ${f}>  Class:   ELF32</span>`);
    w(`<span ${f}>  Machine: ARM (Cortex-M0+)</span>`);
    w(`<span ${f}>  Entry:   0x00000000080010c0</span>`);
    w(``);
    if (name === 'hal_gpio.elf') {
      w(`<span ${f}>Section Headers:</span>`);
      w(`<span ${f}>  [Nr] Name                Type      Addr      Off    Size</span>`);
      w(`<span ${f}>  [ 0] <null>               NULL      00000000  000000 000000</span>`);
      w(`<span ${f}>  [ 1] .text                PROGBITS  08010000  000040 003c20</span>`);
      w(`<span ${f}>  [ 2] .rodata              PROGBITS  08013c20  003c60 000480</span>`);
      w(`<span ${f}>  [ 3] .data                PROGBITS  20000000  004100 000080</span>`);
      w(`<span ${f}>  [ 4] .bss                 NOBITS    20000080  004180 000200</span>`);
      w(`<span ${f}>  [ 5] .ARM.attributes      ARM       00000000  004380 000030</span>`);
      w(`<span ${y}>  [ 6] <span ${y}>.flag                NOTE      deadbeef  ffff00 000040  ← suspicious</span>`);
      w(`<span ${f}>  [ 7] .symtab              SYMTAB    00000000  0043b0 000800</span>`);
      w(`<span ${f}>  [ 8] .strtab              STRTAB    00000000  004bb0 000300</span>`);
      w(`<span ${f}>  [ 9] .shstrtab            STRTAB    00000000  004eb0 000060</span>`);
      w(``);
      w(`<span ${f}>Hint: something's in section [6]. Try <span style="color:var(--color-green)">xxd ${esc(target)}</span> or <span style="color:var(--color-green)">objdump -s --section=.flag ${esc(target)}</span></span>`);
    } else {
      w(`<span ${f}>Section Headers:</span>`);
      w(`<span ${f}>  [Nr] Name     Type      Addr      Off    Size</span>`);
      w(`<span ${f}>  [ 0] .text    PROGBITS  08010000  000040 002400</span>`);
      w(`<span ${f}>  [ 1] .rodata  PROGBITS  08012400  002440 000200</span>`);
      w(`<span ${f}>  [ 2] .data    PROGBITS  20000000  002640 000060</span>`);
      w(`<span ${f}>  [ 3] .bss     NOBITS    20000060  0026a0 000100</span>`);
    }
  },

  xxd(args) {
    const target = args[0];
    if (!target) { wErr('xxd: missing operand'); return; }
    const p = resolvePath(target);
    const node = getNode(p);
    if (!node) { wErr(`xxd: ${target}: No such file or directory`); return; }
    if (node.type === 'dir') { wErr(`xxd: ${target}: Is a directory`); return; }
    const name = p[p.length-1] || '';
    const f = `style="color:var(--color-text-faint)"`;
    const y = `style="color:var(--color-gold)"`;
    if (name === 'hal_gpio.elf') {
      w(`<span ${f}>00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............</span>`);
      w(`<span ${f}>00000010: 0200 2800 0100 0000 c010 0108 3400 0000  ..(.........4...</span>`);
      w(`<span ${f}>00000020: 0000 0000 0200 0005 3400 2000 0100 2800  ........4. ...</span>`);
      w(`<span ${f}>...</span>`);
      w(`<span ${f}>0000ffe0: 464c 4147 7b33 6c66 5f73 3374 6331 6930  </span><span ${y}>FLAG{3lf_s3ct10n_hunt3r}</span>`);
      w(`<span ${f}>0000fff0: 5f68 756e 7433 727d 0000 0000 0000 0000  ........................</span>`);
    } else if (name.endsWith('.elf')) {
      w(`<span ${f}>00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............</span>`);
      w(`<span ${f}>00000010: 0200 2800 0100 0000 d010 0108 3400 0000  ..(.........4...</span>`);
      w(`<span ${f}>00000020: 5869 7374 2069 7320 6e6f 7420 6120 636f  Xist is not a co</span>`);
    } else {
      const hex = Array.from(node.content.slice(0,64))
        .map((c,i) => ({ h: c.charCodeAt(0).toString(16).padStart(2,'0'), c }));
      let out = '00000000: ';
      hex.forEach((x,i) => { out += x.h + (i%2?'':' '); });
      w(`<span ${f}>${esc(out.trim())}  ${esc(node.content.slice(0,16))}</span>`);
    }
  },

  objdump(args) {
    // Accept --section=.flag, --section .flag, -j .flag, or a bare .flag.
    let sec = null;
    const rest = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--section=')) sec = a.slice('--section='.length);
      else if (a === '--section' || a === '-j') sec = args[++i] || null;
      else if (a.startsWith('.') && !a.includes('/')) sec = a;
      else rest.push(a);
    }
    const target = rest.find(a => !a.startsWith('-'));
    if (!target) { wErr('objdump: missing operand'); return; }
    const p = resolvePath(target);
    const node = getNode(p);
    if (!node) { wErr(`objdump: ${target}: No such file or directory`); return; }
    const name = p[p.length-1] || '';
    const f = `style="color:var(--color-text-faint)"`;
    const y = `style="color:var(--color-gold)"`;
    if (name === 'hal_gpio.elf' && sec === '.flag') {
      w(`<span ${f}>${esc(name)}:     file format elf32-littlearm</span>`);
      w(``);
      w(`<span ${f}>Contents of section .flag:</span>`);
      w(`<span ${f}> deadbeef 464c4147 7b336c66 5f733374  </span><span ${y}>FLAG{3lf_s3ct10n</span>`);
      w(`<span ${f}> deadbeff 6331306e 5f68756e 7433727d  </span><span ${y}>_hunt3r}</span>`);
    } else if (name.endsWith('.elf')) {
      w(`<span ${f}>${esc(name)}:     file format elf32-littlearm</span>`);
      w(`<span ${f}>Disassembly of section .text:</span>`);
      w(`<span ${f}>08010000 &lt;Reset_Handler&gt;:</span>`);
      w(`<span ${f}> 8010000: 4800      ldr  r0, [pc, #0]</span>`);
      w(`<span ${f}> 8010002: 4700      bx   r0</span>`);
    } else {
      wErr(`objdump: ${target}: file format not recognized`);
    }
  },

};
