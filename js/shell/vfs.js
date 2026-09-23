// The virtual filesystem the terminal browses. Pure data — no DOM, no side effects.
// `hidden: true` entries only show under `ls -a`; the CTF flags live in here.

export const VFS = {
  type: 'dir', modified: 'Sep  1 2025',
  entries: {
    'about.txt': { type: 'file', size: 248, modified: 'Sep  1 2025',
      content: `Dhairya Bhatia
MS Computer Science — Northeastern University (2025–2027)
BSc Computer Science — University of British Columbia (2020–2024)

ML researcher building and evaluating multimodal and video-language
models. Research Assistant at ACLab (MotionBlind), volunteer at CACTILab
(agentic code generation), Rust on the side.

See ~/publications/ for papers.
Boston, MA · bhatiadhairya19@gmail.com` },
    'contact.txt': { type: 'file', size: 148, modified: 'May 16 10:22',
      content: `email     bhatiadhairya19@gmail.com
linkedin  linkedin.com/in/dhairyanbhatia
github    github.com/dhairyab0069
web       dhairyab0069.github.io` },
    'resume.pdf': { type: 'file', size: 89012, modified: 'May 16 09:14',
      content: '[binary PDF]\n→ https://drive.google.com/file/d/1_D8LCjK2bfaHo3-4DXggA0et4CKQkHvg/view?usp=sharing' },
    'research': { type: 'dir', modified: 'May 10 14:33', entries: {
      'cactilab': { type: 'dir', modified: 'May 10 14:33', entries: {
        'README.md': { type: 'file', size: 512, modified: 'May 10 14:33',
          content: `# Research Project — CACTILab, Northeastern University

Contributed to a research project at CACTILab.
Details to be shared at a later date.` },
        'pipeline.txt': { type: 'file', size: 384, modified: 'May  2 18:41',
          content: `[contents not available for public sharing]` },
        'hal_gpio.elf': { type: 'file', size: 42108, modified: 'May  2 2026',
          content: '[ELF binary — use checksec, readelf, or strings to inspect]' },
        '.classified': { type: 'dir', hidden: true, modified: 'May 10 14:33', entries: {
          'notes.txt': { type: 'file', size: 188, modified: 'May 10 14:33',
            content: `# classified — do not commit

stage 2 prompt injection attempts logged: 3
all contained. model stayed on-task.

root cause: unescaped brace in PAC introspection prompt.
fix: strip { } before feeding to agent.

FLAG{gh0st_1n_th3_h4l}` }
        }},
        'progress.md': { type: 'file', size: 540, modified: 'May 10 14:33',
          content: `[contents not available for public sharing]` }
      }}}
    },
    'projects': { type: 'dir', modified: 'Jan 15 2026', entries: {
      'aclab': { type: 'dir', modified: 'May 20 2026', entries: {
        'README.md': { type: 'file', size: 412, modified: 'May 20 2026',
          content: `# ACLab — Augmented Cognition Lab\nNortheastern University\n\nRole: Research Assistant (May 2026 – Present)\nAdvisor: Prof. Sarah Ostadabbas\n\nContributions:\n  Designed and led MotionBlind — contrastive video benchmark for\n  temporal and motion reasoning in video-LLMs (arXiv:2609.09528)\n  100+ paired clips across 9 motion categories\n  VLM evaluation pipelines on an HPC cluster (SLURM)\n  Collected 50+ video pairs for the TimeBlind Challenge\n  benchmark (CV4Smalls Workshop, CVPR 2026)\n  Paper reviewer — CV4Smalls Workshop, CVPR 2026\n\ncat ~/publications/motionblind.txt` }
      }},
      'escalion': { type: 'dir', modified: 'May 16 11:20', entries: {
        'escalion.elf': { type: 'file', size: 18432, modified: 'May 16 11:20',
          content: '[ELF binary — use checksec or strings to inspect]' },
        'README.md': { type: 'file', size: 298, modified: 'May 16 11:20',
          content: `# Project Escalion — NU Launch Labs

Building a custom game engine in Rust from scratch.
Co-founded the studio through Northeastern's Launch Labs program.

Focus:
  Memory layout and architecture
  Performance-critical subsystems
  Zero-cost abstractions
  Low-level systems design

Status: Early stage — core architecture in progress.
Team:   NU Launch Labs` }
      }},
      'coursify': { type: 'dir', modified: 'Apr 20 2024', entries: {
        'README.md': { type: 'file', size: 261, modified: 'Apr 20 2024',
          content: `# Coursify.ai — UBC CS Capstone

LLM-assisted tools for K-12 educators. Built with a team of 5.

Features: lecture generation, quizzes, slides, course planning
Stack:    ReactJS · NodeJS · GPT-3.5
Status:   Completed April 2024` }
      }}
    }},
    'teaching': { type: 'dir', modified: 'Jan 10 2026', entries: {
      'cs3100': { type: 'dir', modified: 'May 16 08:30', entries: {
        'README.md': { type: 'file', size: 334, modified: 'May 16 08:30',
          content: `# Teaching Assistant — CS3100
# Programming and Design Paradigms II
# Khoury College of Computer Science, Northeastern University

Jan 2026 – Present

Responsibilities:
  Lab and assignment design + testing (pre-release)
  Office hours and lab sessions
  Student debugging support

Research:
  Analyzing student feedback on AI-assisted programming workflows
  Developing framework for human subjects study on AI usage in CS ed` },
        'feedback-study.txt': { type: 'file', size: 189, modified: 'Apr 28 16:12',
          content: `AI Usage Study — CS3100 (in progress)

Collecting + analyzing student feedback on AI-assisted programming
in a course where AI usage is actively encouraged.

Next step: IRB approval for human subjects component.` }
      }}
    }},
    '.env': { type: 'file', size: 312, modified: 'Sep  1 2025', hidden: true,
      content: `# Environment — dhairya@nextcube
EDITOR=vim
SHELL=/bin/zsh
LANG=en_US.UTF-8
RUST_LOG=debug
CARGO_HOME=/home/dhairya/.cargo
ANTHROPIC_API_KEY=sk-ant-[REDACTED]
LANGFUSE_PUBLIC_KEY=pk-lf-[REDACTED]

# nothing to see here
FLAG{d0tf1l3s_n3v3r_l13}` },
    '.bash_history': { type: 'file', size: 420, hidden: true, modified: 'May 16 11:44',
      content: `cat about.txt
cd research/cactilab
cargo build --target thumbv6m-none-eabi
cargo test
strings resume.pdf | grep FLAG
checksec research/cactilab/hal_gpio.elf
readelf -S research/cactilab/hal_gpio.elf
find . -name "*.flag"
ssh dhairya@nextcube` },
    'senate': { type: 'dir', modified: 'Feb 28 2026', entries: {
      'README.md': { type: 'file', size: 243, modified: 'Feb 28 2026',
        content: `# GSG — Graduate Student Government
# Senator for Student Affairs, Northeastern University
# Jan 2026 – Present

Initiatives:
  Club auditing and compliance
  Impact Symposium (volunteering + org)
  Student advocacy and outreach` },
      'awards.txt': { type: 'file', size: 178, modified: 'Mar  1 2026',
        content: `Senator of the Month — February 2026
  Awarded for contributions to student affairs

GLI Emerging Graduate Leader Award
  Graduate Leadership Institute (co-sponsored by GSG)` }
    }}
  }
};

// Shell state
