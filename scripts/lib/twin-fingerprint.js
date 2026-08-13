// Ayni fiziksel aracin FARKLI ilan kaydi olarak tekrar acilmasini yakalayan
// bulanik parmak izi. Tek kaynak: hem import-dealer.js (bayi ilani vs kok kayit)
// hem parse-car-json.js (mobile.de re-list: ayni arac yeni mobileDeId ile) kullanir.
//
// Neden bulanik: VIN cogu ilanda yok, mobileDeId re-list'te degisir, dealerKey
// yalnizca bayi sitelerinde vardir. Geriye kalan tek stabil imza tescil + km + fiyat.
// Esikler: km ±1000 (ilan bekleyen arac yol yapar), fiyat ±500 (kucuk indirim).

import fs from 'fs';
import path from 'path';
import { walkListingFiles, listingsDir } from './listing-id.js';

export const KM_TOLERANCE = 1000;
export const PRICE_TOLERANCE = 500;

const regOf = (car) => (car.firstRegistrationYearAndMonth || []).join('/');

// Kok dosyalar = mobile.de kanonik kayitlari (alt klasorler bayi kayitlaridir).
export function buildRootFingerprints(dir = listingsDir) {
  const out = [];
  for (const file of walkListingFiles(dir)) {
    const rel = path.relative(dir, file);
    if (rel.includes(path.sep)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!Array.isArray(data)) continue;
    for (const car of data) {
      if (!car.firstRegistrationYearAndMonth || !car.basePriceEuro) continue;
      out.push({
        listingId: car.listingId,
        mobileDeId: car.mobileDeId ? String(car.mobileDeId) : null,
        reg: regOf(car),
        km: car.mileageKm || 0,
        price: car.basePriceEuro,
        seller: car.sellerTypeOrName || '',
        file,                                  // mutlak yol — cagiran dosyayi acabilir
        rel: rel.replace(/\.json$/, '')        // rapor/log icin kisa ad
      });
    }
  }
  return out;
}

// parsed: listing semasindaki kayit (firstRegistrationYearAndMonth/mileageKm/basePriceEuro).
// excludeMobileDeId: kaydin KENDISI parmak izi havuzundaysa kendini ikiz sanmasin.
export function findTwin(fingerprints, parsed, { excludeMobileDeId = null, excludeListingId = null } = {}) {
  const reg = regOf(parsed);
  if (!reg || !parsed.basePriceEuro) return null;
  return fingerprints.find(f =>
    f.reg === reg &&
    Math.abs(f.km - (parsed.mileageKm || 0)) <= KM_TOLERANCE &&
    Math.abs(f.price - (parsed.basePriceEuro || 0)) <= PRICE_TOLERANCE &&
    (!excludeMobileDeId || f.mobileDeId !== String(excludeMobileDeId)) &&
    (!excludeListingId || f.listingId !== excludeListingId)
  ) || null;
}

export function twinHint(twin, { seller } = {}) {
  const sellerPart = seller && twin.seller && seller !== twin.seller
    ? ` (satıcı FARKLI: "${seller}" vs "${twin.seller}")`
    : twin.seller ? ` (satıcı: "${twin.seller}")` : '';
  return `tescil ${twin.reg} + ~${twin.km}km + ~€${twin.price} eşleşiyor — aynı fiziksel araç olabilir${sellerPart}`;
}
