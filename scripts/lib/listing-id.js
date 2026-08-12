// Site-onekli listingId tahsisi (W1, AHG3, ...) — bayi crawl'lari icin.
//
// Neden ayri seri: mobile.de akisinin C-serisi ureticisi (parse-car-json.js
// getNextListingId) yalnizca kok listing dosyalarini tarar ve oyle kalir.
// Bayi araclari site onekiyle kendi serisini aldigi icin C-serisiyle cakisma
// YAPISAL olarak imkansizdir; iki uretici birbirinin dosyalarini bilmek zorunda degil.
//
// Yine de allocator, src/data/listings/** agacinin TAMAMINI (alt klasorler dahil)
// tarar — ayni onek birden fazla dosyada/klasorde gecmis olsa bile max dogru bulunur.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const listingsDir = path.resolve(__dirname, '../../src/data/listings');

// src/data/listings/**/*.json — bir seviye alt klasor yeterli (site klasorleri).
export function walkListingFiles(dir = listingsDir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(full)) {
        if (sub.endsWith('.json')) out.push(full + path.sep + sub);
      }
    } else if (entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

export function maxListingIdNumber(prefix, dir = listingsDir) {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const file of walkListingFiles(dir)) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!Array.isArray(data)) continue;
    for (const car of data) {
      const m = typeof car?.listingId === 'string' && car.listingId.match(re);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return max;
}

// Bir crawl kosusu icin tahsisci: diski BIR kez okur, sonra bellekte artirir.
export function createIdAllocator(prefix, dir = listingsDir) {
  let current = maxListingIdNumber(prefix, dir);
  return { next: () => `${prefix}${++current}` };
}
