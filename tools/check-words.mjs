// Validates every word list in js/data: a–z only, tier lengths, no duplicates,
// and a minimum count. Usage: node tools/check-words.mjs [--min-per-tier N]
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const TIER_LENGTHS = { short: [3, 4], medium: [5, 7], long: [8, 11] };
const argIndex = process.argv.indexOf('--min-per-tier');
const MIN_PER_TIER = argIndex > -1 ? Number(process.argv[argIndex + 1]) : 100;

const dataDir = path.resolve(import.meta.dirname, '../js/data');
const files = (await readdir(dataDir)).filter((f) => /^words\.\w+\.js$/.test(f));
let failed = false;

for (const file of files) {
  const { default: list } = await import(pathToFileURL(path.join(dataDir, file)));
  const errors = [];
  const seen = new Set();
  let total = 0;

  for (const [tier, [min, max]] of Object.entries(TIER_LENGTHS)) {
    const words = list[tier] ?? [];
    total += words.length;
    if (words.length < MIN_PER_TIER) errors.push(`${tier}: ${words.length} words (need ${MIN_PER_TIER})`);
    for (const w of words) {
      if (!/^[a-z]+$/.test(w)) errors.push(`${tier}: "${w}" has characters outside a–z`);
      if (w.length < min || w.length > max) errors.push(`${tier}: "${w}" is ${w.length} letters (want ${min}–${max})`);
      if (seen.has(w)) errors.push(`${tier}: duplicate "${w}"`);
      seen.add(w);
    }
  }

  const counts = Object.keys(TIER_LENGTHS).map((t) => `${t} ${list[t]?.length ?? 0}`).join(', ');
  if (errors.length) {
    failed = true;
    console.log(`✗ ${file} (${counts}, total ${total})`);
    for (const e of errors) console.log(`    ${e}`);
  } else {
    console.log(`✓ ${file} (${counts}, total ${total})`);
  }
}

process.exit(failed ? 1 : 0);
