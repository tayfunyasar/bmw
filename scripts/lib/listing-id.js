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

// Gecerli listingId sozlesmesi: BUYUK HARF oneki + sayi (C1045, W2, BMW3 ...).
// Tek kaynak burasi — lint (enforce-listings) bunu kullanir, boylece tahsis ile
// dogrulama ayni deseni paylasir. Gecmiste bu kontrol yoktu ve URL parcasindan
// tureyen `id=445587983` gibi ID'ler agaca sizdi (tarama raporunda ham query
// string olarak gorundu); desen artik lint tarafindan zorunlu.
export const LISTING_ID_PATTERN = /^[A-Z]+\d+$/;

export function isValidListingId(listingId) {
  return typeof listingId === 'string' && LISTING_ID_PATTERN.test(listingId);
}

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
