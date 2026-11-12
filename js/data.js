/* data.js — the things you are most likely to edit.
   - CONFIG.intro: false turns off the opening flight to Low Library.
   - CONFIG.flight: false turns off the short map flight between stops (Back / Next / arrow keys).
   - CONFIG.hidden: section ids to leave out of the page, the map and the tour
     (for example ['speed']).
   - NODES / EDGES: the research map. `ch` is the id of the section a node opens. */
window.HZ = window.HZ || {};

HZ.CONFIG = {
  intro: true,
  flight: true,
  hidden: [],
  portrait: {
    local: 'assets/hao_zou.jpg',
    remote: 'https://haozou-official.github.io/images/hao_zou.jpg'
  }
};

/* lane: gen = diffusion and faithful generation, eff = efficient inference, agents = agents and RL */
HZ.NODES = [
  { id: 'seed',    x: 50,   y: 300, lane: 'seed',   size: 5,  name: '2021', venue: '', lp: 'below', ch: null },
  { id: 'qa',      x: 150,  y: 450, lane: 'agents', size: 9,  name: 'Trivia to natural questions', venue: 'EMNLP 2024', lp: 'below', ch: 'roots',
    blurb: 'Rewriting expert-written trivia into search-style questions to train retrieval and QA. University of Maryland.' },
  { id: 'icl',     x: 236,  y: 225, lane: 'gen',    size: 7,  name: 'Debiasing in-context learning', venue: 'manuscript, 2023', lp: 'above', ch: 'roots',
    blurb: 'A causal-inference-inspired estimate of how the input text moves each candidate label. University of Minnesota.' },
  { id: 'sony',    x: 320,  y: 450, lane: 'agents', size: 7,  name: 'RL for controllable text', venue: 'Sony Research', lp: 'above', ch: 'roots',
    blurb: 'PPO with representation fusion for multi-style generation. My first reinforcement-learning project.' },
  { id: 'survey',  x: 400,  y: 150, lane: 'gen',    size: 9,  name: 'Diffusion survey', venue: 'arXiv 2023', lp: 'above', ch: 'survey',
    blurb: 'First-author survey of diffusion formulations for text generation and editing.' },
  { id: 'duke',    x: 560,  y: 150, lane: 'gen',    size: 7,  name: 'Diffusion vs. flow matching', venue: 'Duke, 2024', lp: 'below', ch: 'roots',
    blurb: 'Benchmarks comparing training paradigms, prediction objectives and architectures.' },
  { id: 'ibm',     x: 560,  y: 300, lane: 'eff',    size: 7,  name: 'KV-cache quantization', venue: 'IBM, 2024', lp: 'below', ch: 'roots',
    blurb: 'Johnson–Lindenstrauss-based KV-cache quantization with sparsity pruning.' },
  { id: 'mdlm',    x: 628,  y: 150, lane: 'gen',    size: 11, name: 'Reasoning as infilling', venue: 'COLM 2026', lp: 'above', ch: 'mdlm',
    blurb: 'Reasoning-as-infilling: early exits, post-hoc reasoning traces and adaptive decoding.' },
  { id: 'drr',     x: 920,  y: 150, lane: 'gen',    size: 16, name: 'Detect, Remask, Repair', venue: 'EMNLP 2026, oral', lp: 'above', anchor: 'end', lx: 938, ch: 'drr', big: true,
    blurb: 'First author. Localized diffusion editing that repairs only the stale spans of a summary.' },
  { id: 'bengal',  x: 1050, y: 80,  lane: 'gen',    size: 9,  name: 'BENGAL Living Report', venue: 'IARPA, demo', lp: 'right', ch: 'bengal',
    blurb: 'An analyst-facing report that revises itself as evidence arrives. I lead the demo.' },
  { id: 'stream',  x: 1050, y: 300, lane: 'eff',    size: 11, name: 'Faster streaming summaries', venue: 'Capital One, 2026', lp: 'below', ch: 'speed',
    blurb: 'Speculative decoding for live summary updates: draft, verify, commit.' },
  { id: 'osworld', x: 860,  y: 450, lane: 'agents', size: 11, name: 'OSWorld 2.0', venue: 'ICLR 2027 submission', lp: 'above', ch: 'osworld',
    blurb: '108 long-horizon computer-use workflows that show where agents break.' },
  { id: 'forge',   x: 1000, y: 450, lane: 'agents', size: 11, name: 'OpenForgeRL', venue: 'ICLR 2027 submission', lp: 'below', ch: 'openforge',
    blurb: 'Train agents with RL inside the same harness they are deployed with.' },
  { id: 'alf',     x: 1125, y: 450, lane: 'agents', size: 9,  name: 'Stale rollouts in RL', venue: 'ongoing', lp: 'above', ch: 'staleness',
    blurb: 'Synchronous, asynchronous and single-rollout RL training in ALFWorld: what staleness costs.' },
  { id: 'next',    x: 1218, y: 300, lane: 'next',   size: 13, name: 'PhD', venue: 'commit and revise', lp: 'right', ch: 'next',
    blurb: 'An agent that commits like an autoregressive model and revises like a diffusion model.' }
];

HZ.EDGES = [
  ['seed', 'qa'], ['seed', 'icl'], ['icl', 'survey'], ['qa', 'sony'],
  ['survey', 'duke'], ['survey', 'ibm'], ['duke', 'mdlm'], ['mdlm', 'drr'],
  ['drr', 'bengal'], ['drr', 'stream'], ['ibm', 'stream'],
  ['sony', 'osworld'], ['osworld', 'forge'], ['forge', 'alf'],
  ['bengal', 'next'], ['stream', 'next'], ['alf', 'next']
];

HZ.LANE = {
  seed: 'var(--ink-3)', gen: 'var(--sky)', eff: 'var(--lilac)', agents: 'var(--peach)', next: 'var(--ok)'
};

HZ.YEARS = [[150, '2021'], [320, '2022'], [400, '2023'], [560, '2024'], [628, '2025'], [920, '2026'], [1218, '2027']];
