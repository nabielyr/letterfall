import { PALETTE } from '../config.js';

// Sprites are rows of hex digits indexing the PICO-8 palette; '.' is transparent.
// Letters other than hex digits are placeholders filled from a color map at
// bake time (e.g. 'o' = outline, 'b' = body), so one shape serves several looks.
// Each sprite is baked once into a tiny canvas and drawn with drawImage.
const SPRITES = {
  heart: [
    '.11.11.',
    '1781881',
    '1888881',
    '1888881',
    '.18881.',
    '..181..',
    '...1...',
  ],
  heartEmpty: [
    '.11.11.',
    '1551551',
    '1555551',
    '1555551',
    '.15551.',
    '..151..',
    '...1...',
  ],

  // Mascot: umbrella canopy, the kid (face drawn separately), and faces.
  umbrella: [
    '......1111......',
    '....11888811....',
    '...18ee888881...',
    '..18ee88888881..',
    '.18e88888888881.',
    '1888888888888881',
    '.11.11.11.11.11.',
  ],
  kid: [
    '....1111........',
    '...144441.......',
    '..14444441......',
    '..14ffff41......',
    '..1ffffff1......',
    '..1ffffff1......',
    '...111111.......',
    '..1aaaaaaa1f....',
    '.1aaaaaaaaa1....',
    '.1aaaa9aaaa1....',
    '.1aaaa9aaaa1....',
    '..1aaa9aaa1.....',
    '..199999991.....',
    '...1c1.1c1......',
    '..1cc1.1cc1.....',
    '..1111.1111.....',
  ],
  // 6×2, drawn over the kid's face area at (3, 4).
  faceIdle: ['f0ff0f', 'ef88fe'],
  faceBlink: ['f1ff1f', 'ef88fe'],
  faceHappy: ['f1ff1f', 'e8888e'],
  faceScared: ['00ff00', 'ef11fe'],
  faceSad: ['f1ff1f', 'cf11ff'],

  // Power-up icons hanging under the balloons (life uses `heart`).
  iconSlow: [
    '.11111.',
    '1777771',
    '1771771',
    '1771171',
    '1777771',
    '1777771',
    '.11111.',
  ],
  iconBomb: [
    '....9a.',
    '...1...',
    '.11111.',
    '1161111',
    '1611111',
    '1111111',
    '.11111.',
  ],

  // Falling-star word: a five-point star and a smaller sparkle, alternated to twinkle.
  star: [
    '....a....',
    '....a....',
    '...aaa...',
    'aaaa7aaaa',
    '.aa777aa.',
    '..aaaaa..',
    '..aa.aa..',
    '.aa...aa.',
    '.a.....a.',
  ],
  sparkle: [
    '.........',
    '....7....',
    '....a....',
    '...aaa...',
    '.7aa7aa7.',
    '...aaa...',
    '....a....',
    '....7....',
    '.........',
  ],

  // Music toggle (♫), drawn on a navy plate next to the mute button.
  musicOn: [
    '...777777.',
    '...7....7.',
    '...7....7.',
    '...7....7.',
    '.777..777.',
    '7777.7777.',
    '.77...77..',
    '..........',
  ],
  musicOff: [
    '8..666666.',
    '.8.6....6.',
    '..86....6.',
    '...8....6.',
    '.6668.666.',
    '6666.8666.',
    '.66...86..',
    '.......8..',
  ],

  // Mute toggle, drawn on a navy plate.
  speakerOn: [
    '...7......',
    '..77....7.',
    '7777..7..7',
    '7777...7.7',
    '7777...7.7',
    '7777..7..7',
    '..77....7.',
    '...7......',
  ],
  speakerOff: [
    '...7......',
    '..77......',
    '7777..8..8',
    '7777...88.',
    '7777...88.',
    '7777..8..8',
    '..77......',
    '...7......',
  ],

  // Raindrop tip; its last row overlaps the container's top outline.
  dropTip: [
    '...o...',
    '..obo..',
    '..obo..',
    '.obbbo.',
    '.obbbo.',
  ],
};

const cache = new Map();

// rows: sprite rows; colors: optional { letter: hexDigit } for placeholders.
export function bake(rows, colors) {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      let ch = row[x];
      if (ch === '.') continue;
      if (colors && colors[ch] !== undefined) ch = colors[ch];
      ctx.fillStyle = PALETTE[parseInt(ch, 16)];
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

// sprite('dropTip', { o: '1', b: '7' }) → cached canvas for that color set.
export function sprite(name, colors) {
  const key = colors ? `${name}|${Object.entries(colors).join()}` : name;
  let img = cache.get(key);
  if (!img) {
    img = bake(SPRITES[name], colors);
    cache.set(key, img);
  }
  return img;
}

export const SPRITE_DATA = SPRITES;
