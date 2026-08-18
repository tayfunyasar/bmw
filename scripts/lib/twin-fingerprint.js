// Ayni fiziksel aracin FARKLI ilan kaydi olarak tekrar acilmasini yakalayan
// bulanik parmak izi. Tek kaynak: hem import-dealer.js (bayi ilani vs kok kayit)
// hem parse-car-json.js (mobile.de re-list: ayni arac yeni mobileDeId ile) kullanir.
//
// Neden bulanik: VIN cogu ilanda yok, mobileDeId re-list'te degisir, dealerKey
// yalnizca bayi sitelerinde vardir. Geriye kalan tek stabil imza tescil + km + fiyat.
// Esikler: km ±1000 (ilan bekleyen arac yol yapar), fiyat ±500 (kucuk indirim).

import { listingsDir, rootCategories, readCategory, carPath } from './listings-store.js';

export const KM_TOLERANCE = 1000;
export const PRICE_TOLERANCE = 500;

const regOf = (car) => (car.firstRegistrationYearAndMonth || []).join('/');

// Imza yalnizca KAYITLI (kullanilmis) araclarda guvenilirdir. Sifir/tescilsiz
// araclarda uc bilesen de ayirt edici degildir: tescil yok ([null,null] -> "/"),
// km hepsi ~10, fiyat ayni trim'de birebir liste fiyati. C941/C753 vakasi:
// iki FARKLI renk/saticidaki sifir arac salt bu yuzden ikiz sanilmisti.
export const MIN_FINGERPRINT_KM = 1000;   // KM_TOLERANCE ile tutarli: altinda km sinyal tasimaz
export const hasReliableFingerprint = (car) => {
  const [y, m] = car.firstRegistrationYearAndMonth || [];
  return y != null && m != null && (car.mileageKm || 0) >= MIN_FINGERPRINT_KM && !!car.basePriceEuro;
};

// Tek bir kaydin parmak izi — guvenilir imza yoksa null (sifir/tescilsiz arac).
// buildRootFingerprints ve run-ici elle ekleme (parse-car-json) AYNI kurali kullanir.
export function fingerprintOf(car, extra = {}) {
  if (!hasReliableFingerprint(car)) return null;
  return {
    listingId: car.listingId,
    mobileDeId: car.mobileDeId ? String(car.mobileDeId) : null,
    reg: regOf(car),
    km: car.mileageKm || 0,
    price: car.basePriceEuro,
    seller: car.sellerTypeOrName || '',
    file: null,
    rel: null,
    ...extra,
  };
}

// Kok kategoriler = mobile.de kanonik kayitlari (site klasorleri bayi kayitlaridir).
// fp.file = aracin kendi dosyasi (abs), fp.rel = kategori adi.
export function buildRootFingerprints(dir = listingsDir) {
  const out = [];
  for (const category of rootCategories(dir)) {
    for (const car of readCategory(category, dir)) {
      const fp = fingerprintOf(car, { file: carPath(category, car.listingId, dir), rel: category });
      if (fp) out.push(fp);
    }
  }
  return out;
}

// parsed: listing semasindaki kayit (firstRegistrationYearAndMonth/mileageKm/basePriceEuro).
// excludeMobileDeId: kaydin KENDISI parmak izi havuzundaysa kendini ikiz sanmasin.
export function findTwin(fingerprints, parsed, { excludeMobileDeId = null, excludeListingId = null } = {}) {
  if (!hasReliableFingerprint(parsed)) return null;
  const reg = regOf(parsed);
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
