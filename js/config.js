// PICO-8 palette, indexed 0–f so sprite data can reference colors by hex digit.
export const PALETTE = [
  '#000000', // 0 black
  '#1d2b53', // 1 dark blue
  '#7e2553', // 2 dark purple
  '#008751', // 3 dark green
  '#ab5236', // 4 brown
  '#5f574f', // 5 dark grey
  '#c2c3c7', // 6 light grey
  '#fff1e8', // 7 white
  '#ff004d', // 8 red
  '#ffa300', // 9 orange
  '#ffec27', // a yellow
  '#00e436', // b green
  '#29adff', // c blue
  '#83769c', // d lavender
  '#ff77a8', // e pink
  '#ffccaa', // f peach
];

export const C = {
  black: PALETTE[0],
  navy: PALETTE[1],
  plum: PALETTE[2],
  forest: PALETTE[3],
  brown: PALETTE[4],
  grey: PALETTE[5],
  silver: PALETTE[6],
  white: PALETTE[7],
  red: PALETTE[8],
  orange: PALETTE[9],
  yellow: PALETTE[10],
  green: PALETTE[11],
  blue: PALETTE[12],
  lavender: PALETTE[13],
  pink: PALETTE[14],
  peach: PALETTE[15],
};

export const FONTS = {
  word: '"Pixelify Sans", monospace',
  ui: '"Silkscreen", monospace',
  debug: 'monospace',
};

// Native world resolution. The integer scale is picked so the minimum size
// fits; then W/H stretch up to the maximum to fill the screen without
// letterboxing. Portrait's small minimum height keeps the playfield large when
// the mobile keyboard covers half the screen.
export const VIEW = {
  landscape: { minW: 384, minH: 216, maxW: 512, maxH: 288 },
  portrait: { minW: 216, minH: 240, maxW: 260, maxH: 480 },
};

export const MAX_DT = 0.05;

export const GROUND_H = 24;

export const WORD = {
  fontSize: 10,
  padX: 8, // room for the rounded caps of the containers
  height: 16,
  headroom: 8, // space above the body for the raindrop tip / meteor flames
  edgeMargin: 4,
};

// The sky cycles on a timer while playing (like a day/night cycle), so the
// scenery keeps changing. Seconds per theme; the cycle then repeats.
export const THEMES = {
  cycle: [
    ['day', 40],
    ['dusk', 20],
    ['night', 40],
    ['dawn', 20],
  ],
  // What the words fall as under each sky.
  containers: { day: 'drop', dusk: 'meteor', night: 'star', dawn: 'drop' },
  fadeTime: 2.4, // seconds for the dithered sky crossfade
};

export const MASCOT = {
  dangerLine: 0.75, // a word below this fraction of the playfield scares the mascot
  happyTime: 0.6,
  sadTime: 1.5,
  danceCombo: 10,
};

export const FX = {
  shakeTime: 0.3,
  hurtShake: 3, // world px
  bombShake: 4,
  meteorShake: 1,
  flashTime: 0.35,
  perfectMinLength: 6, // "PERFECT!" pop-up only for longer words, so it stays special
  comboMilestone: 5, // "COMBO x5!", x10, …
  hypeCombo: [10, 20], // stronger effects from these combos
};

export const POWERUP = {
  minLevel: 2,
  chance: 0.05, // per spawned word
  fallTimeFactor: 1.25, // balloons drift down slower
  slowFactor: 0.4,
  slowTime: 6,
  bombScoreFactor: 0.5,
};

export const TRANSITION = {
  duration: 0.35, // each half: cover, then reveal
  block: 16, // world px
};

export const RULES = {
  lives: 3,
  maxLives: 5,
  gameOverReveal: 0.9, // seconds of frozen playfield before the game-over panel
  gameOverInputDelay: 1.4, // seconds before the game-over screen accepts input
};

export const SCORE = {
  perLetter: 10,
  comboStep: 5, // multiplier rises every N combo
  comboBonus: 0.5,
  maxMultiplier: 4,
  perfectBonus: 0.5, // +50% for a word typed without mistakes
};

export const STATS = {
  wpmWarmup: 3, // seconds before live WPM is shown
  rollingWindow: 10, // seconds, for peak WPM
};

// Each preset ramps from its first value to its second over rampSeconds.
// fallTime: seconds from top to ground. tierWeights: short / medium / long words.
export const DIFFICULTY = {
  levelSeconds: 30,
  fallJitter: 0.15, // ± fraction of fallTime per word
  spawnJitter: 0.2,
  presets: {
    easy: {
      rampSeconds: 360,
      fallTime: [10.5, 5],
      spawnInterval: [2.6, 1.2],
      maxWords: [2, 6],
      tierWeights: [
        [90, 10, 0],
        [45, 40, 15],
      ],
    },
    medium: {
      rampSeconds: 300,
      fallTime: [9, 3.5],
      spawnInterval: [2.2, 0.7],
      maxWords: [3, 9],
      tierWeights: [
        [80, 20, 0],
        [25, 45, 30],
      ],
    },
    hard: {
      rampSeconds: 240,
      fallTime: [7, 2.8],
      spawnInterval: [1.6, 0.5],
      maxWords: [4, 12],
      tierWeights: [
        [50, 40, 10],
        [10, 40, 50],
      ],
    },
  },
};

export const DIFFICULTIES = Object.keys(DIFFICULTY.presets);

export const LEADERBOARD = {
  size: 10,
  nameMax: 10,
  api: '/api/leaderboard',
  timeout: 6000, // ms before falling back to the on-device board
};
