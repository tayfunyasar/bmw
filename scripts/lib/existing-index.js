// Tum kayitli ilanlarin (alt klasorler DAHIL) uc anahtarli dizini:
//   byMobileDeId  — mobile.de kimligi (bayi sayfasi mobile.de ikizine linkliyse de yakalar)
//   byVin         — sasi no; ayni fiziksel arac iki kaynakta/yeni URL'de yakalanir (C692 vakasi)
//   byDealerKey   — site-scoped anahtar, kayitli dealerListingUrl'den turetilir (sema degisikligi yok)
//
// Tek kaynak: filter-listings.js ve import-dealer.js bu modulu kullanir.

import fs from 'fs';
import path from 'path';
import { walkListingFiles, listingsDir } from './listing-id.js';
import { loadDealerSites, dealerKeyFor } from './dealer-sites.js';

// Bir kaydin TUM bayi ilan URL'leri. `dealerListingUrl` birincil (geriye donuk
// uyumluluk + UI'daki tek link), `dealerListingUrls` ek sitelerin URL'leri.
// Tek kaynak: index, merge-twin ve enforce bunu kullanir.
export function dealerUrlsOf(car) {
  const out = [];
  if (car?.dealerListingUrl) out.push(car.dealerListingUrl);
  for (const u of car?.dealerListingUrls || []) if (u && !out.includes(u)) out.push(u);
  return out;
}

export function buildExistingIndex(dir = listingsDir) {
  const byMobileDeId = new Map();
  const byVin = new Map();
  const byDealerKey = new Map();
  const sites = loadDealerSites();

  for (const file of walkListingFiles(dir)) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!Array.isArray(data)) continue;
    const rel = path.relative(dir, file).replace(/\.json$/, '');
    for (const car of data) {
      const hit = { file: rel, listingId: car.listingId || null };
      if (car?.mobileDeId) byMobileDeId.set(String(car.mobileDeId), hit);
      if (car?.vin) byVin.set(String(car.vin).toUpperCase(), hit);
      // Bir arac BIRDEN COK bayide listelenebilir (C264: WELLER + BMW_DE). Tek
      // dealerListingUrl indekslemek yetmiyordu: ikinci sitenin URL'si hicbir zaman
      // anahtara donusmedigi icin ayni arac her taramada "new" gorunuyordu.
      for (const url of dealerUrlsOf(car)) {
        // Hangi siteye ait oldugunu URL'den bilemeyiz; her site config'iyle anahtar uret.
        // dealerKeyFor pattern eslesmezse URL-fallback dondurur — o da tekildir.
        for (const site of sites) {
          const key = dealerKeyFor(site, url);
          if (key && !byDealerKey.has(key)) byDealerKey.set(key, hit);
        }
      }
    }
  }
  return { byMobileDeId, byVin, byDealerKey };
}

// Oncelik: mobileDeId -> vin -> dealerKey. Bulunan ilk eslesme doner.
export function lookupListing(index, { mobileDeId, vin, dealerKey } = {}) {
  if (mobileDeId && index.byMobileDeId.has(String(mobileDeId))) return index.byMobileDeId.get(String(mobileDeId));
  if (vin && index.byVin.has(String(vin).toUpperCase())) return index.byVin.get(String(vin).toUpperCase());
  if (dealerKey && index.byDealerKey.has(dealerKey)) return index.byDealerKey.get(dealerKey);
  return null;
}
