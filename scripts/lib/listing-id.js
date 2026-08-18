// Site-onekli listingId tahsisi (W1, AHG3, ...) — bayi crawl'lari icin.
//
// Neden ayri seri: mobile.de akisi C-serisini kullanir, bayi araclari site
// onekiyle kendi serisini alir; cakisma YAPISAL olarak imkansizdir (regex
// ^PREFIX(\d+)$ tam onek ister).
//
// Tahsis kaynagi: src/data/listings/** agacindaki DOSYA ADLARI (per-car yerlesimde
// dosya adi == listingId, lint bunu garantiler). Icerik parse edilmedigi icin
// bozuk bir JSON bile ID'sini "kullanilmis" sayar — ayni ID asla iki kez verilmez.

import { listingsDir, walkCarFiles } from './listings-store.js';

export { listingsDir };

export function maxListingIdNumber(prefix, dir = listingsDir) {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const { listingId } of walkCarFiles(dir)) {
    const m = listingId.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

// Bir crawl kosusu icin tahsisci: diski BIR kez okur, sonra bellekte artirir.
export function createIdAllocator(prefix, dir = listingsDir) {
  let current = maxListingIdNumber(prefix, dir);
  return { next: () => `${prefix}${++current}` };
}
