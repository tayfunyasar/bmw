#!/usr/bin/env node
// stdin: { items: [{ id, title, subTitle?, sponsored? }, ...] }
// stdout: { kept: [...], skipped: [...] }
//
// kept[i].status: 'existing' (src/data/listings/*.json icinde mobileDeId esleti var)
//                 veya 'new' (henuz kayitli degil).
// kept[i].existingIn: hangi dosyada bulundu (existing ise).
// kept[i].existingListingId: lokal listingId (varsa).
//
// Sinifllandirma kurali tek kaynakta: scripts/lib/body-style.js
// Ayni kurali parse-car-json.js da kullanir.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyBodyStyle } from './lib/body-style.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const listingsDir = path.resolve(__dirname, '../src/data/listings');

function buildExistingIndex() {
  const index = new Map(); // mobileDeId -> { file, listingId }
  const files = fs.readdirSync(listingsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(listingsDir, file), 'utf8'));
    if (!Array.isArray(data)) continue;
    for (const car of data) {
      if (car?.mobileDeId) {
        index.set(String(car.mobileDeId), { file: file.replace(/\.json$/, ''), listingId: car.listingId || null });
      }
    }
  }
  return index;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.error('Geçersiz JSON girdi:', err.message);
    process.exit(1);
  }
  const items = Array.isArray(payload) ? payload : (payload.items || []);
  const existing = buildExistingIndex();

  const kept = [];
  const skipped = [];
  for (const item of items) {
    if (item.sponsored) {
      skipped.push({ ...item, reason: 'Sponsorlu' });
      continue;
    }
    const bodyStyle = classifyBodyStyle(item);
    if (bodyStyle === 'GRAN_COUPE') {
      skipped.push({ ...item, reason: 'GranCoupe', bodyStyle });
      continue;
    }
    if (bodyStyle === 'CABRIO') {
      skipped.push({ ...item, reason: 'Cabrio', bodyStyle });
      continue;
    }
    const hit = item.id != null ? existing.get(String(item.id)) : null;
    kept.push({
      ...item,
      bodyStyle,
      status: hit ? 'existing' : 'new',
      existingIn: hit?.file || null,
      existingListingId: hit?.listingId || null
    });
  }
  process.stdout.write(JSON.stringify({ kept, skipped }, null, 2));
});
