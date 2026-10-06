import { C, MASCOT } from '../config.js';
import { sprite } from './sprites.js';

const FACES = {
  idle: 'faceIdle',
  blink: 'faceBlink',
  happy: 'faceHappy',
  scared: 'faceScared',
  sad: 'faceSad',
};

// The umbrella kid standing on the ground. Mood priority:
// sad (just lost a life / game over) > scared (word close to the ground) > happy > idle.
export function createMascot() {
  const m = {
    mood: 'idle',
    happy: 0,
    sad: 0,
    dance: false,
    defeated: false,
    t: 0,
    blinkIn: 2,
    blinking: 0,
  };

  m.reset = () => {
    m.happy = 0;
    m.sad = 0;
    m.dance = false;
    m.defeated = false;
  };

  m.cheer = (combo) => {
    m.happy = MASCOT.happyTime * (combo >= 5 ? 1.6 : 1);
    m.dance = combo >= MASCOT.danceCombo;
  };

  m.hurt = () => {
    m.sad = MASCOT.sadTime;
    m.happy = 0;
    m.dance = false;
  };

  m.defeat = () => {
    m.defeated = true;
  };

  m.update = (dt, scared) => {
    m.t += dt;
    m.happy = Math.max(0, m.happy - dt);
    m.sad = Math.max(0, m.sad - dt);
    m.blinking = Math.max(0, m.blinking - dt);
    m.blinkIn -= dt;
    if (m.blinkIn <= 0) {
      m.blinking = 0.12;
      m.blinkIn = 2 + Math.random() * 3;
    }
    if (m.defeated || m.sad > 0) m.mood = 'sad';
    else if (scared) m.mood = 'scared';
    else if (m.happy > 0) m.mood = 'happy';
    else m.mood = 'idle';
  };

  m.draw = (r, cx, groundY) => {
    const t = m.t;
    let x = Math.round(cx - 8);
    let y = groundY - 16;
    let lift = 0; // umbrella height above its rest position
    let face = m.blinking > 0 ? 'blink' : 'idle';

    switch (m.mood) {
      case 'happy':
        y -= Math.round(Math.abs(Math.sin(t * 10)) * 4);
        lift = 3;
        face = 'happy';
        if (m.dance) x += Math.round(Math.sin(t * 8) * 2);
        break;
      case 'scared':
        x += Math.floor(t * 30) % 2 ? 1 : -1;
        face = 'scared';
        break;
      case 'sad':
        lift = -3;
        face = 'sad';
        break;
      default:
        lift = Math.floor(t * 2) % 2; // gentle bob
        break;
    }

    const umbY = y - 8 - lift;
    r.rect(x + 11, umbY + 6, 1, y + 7 - (umbY + 6), C.grey); // pole down to the hand
    r.sprite(sprite('kid'), x, y);
    r.sprite(sprite(FACES[face]), x + 3, y + 4);
    r.sprite(sprite('umbrella'), x, umbY);
  };

  return m;
}
