import en from './en.js';
import id from './id.js';

const tables = { en, id };
let current = 'en';

export const LANGS = Object.keys(tables);

export function setLang(lang) {
  if (tables[lang]) current = lang;
  document.documentElement.lang = current;
}

export function getLang() {
  return current;
}

// A string in a specific language, regardless of the current one
// (used for the language picker, where each option names itself).
export function tIn(lang, key) {
  return tables[lang]?.[key] ?? tables.en[key] ?? key;
}

// t('best', { score: 10 }) → "BEST 10 …"; falls back to English, then the key.
export function t(key, params) {
  let s = tables[current][key] ?? tables.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) s = s.replaceAll(`{${name}}`, value);
  }
  return s;
}
