import { POWERUP, RULES } from './config.js';

// Rare golden balloons carry a power-up; typing the word triggers it.
// Missing a balloon costs nothing — it just floats away.
export const POWERS = {
  slow: { icon: 'iconSlow', popup: 'popSlow' },
  bomb: { icon: 'iconBomb', popup: 'popBomb' },
  life: { icon: 'heart', popup: 'popLife' },
};

// Returns a power name, or null for a normal word.
export function rollPower(level, lives) {
  if (level < POWERUP.minLevel || Math.random() > POWERUP.chance) return null;
  const options = Object.keys(POWERS).filter((p) => p !== 'life' || lives < RULES.maxLives);
  return options[Math.floor(Math.random() * options.length)];
}
