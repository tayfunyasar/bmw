// Kullanici teyidiyle "sunroof yok" isareti: S403A=no + override + dogru kategoriye tasima.
// Tasima mantigi ortak moveListing'te (lib/move-listing.js) — burada kopya tutulmaz.

import { moveListing, pushAudit } from './lib/move-listing.js';
import { LISTING_FILES } from './lib/listings-store.js';

// Kaynak (sunroof'lu/varsayimli) kategoriler + hedef — config'te (withoutSunroof).
const TARGET_CATEGORY = LISTING_FILES.withoutSunroof.targetCategory;
const SOURCE_CATEGORIES = LISTING_FILES.withoutSunroof.sourceCategories;

const id = process.argv[2];
if (!id) {
  console.error('Kullanım: npm run move:withoutsunroof -- <mobileDeId | listingId>');
  process.exit(1);
}

const result = moveListing({
  id,
  sourceCategories: SOURCE_CATEGORIES,
  pickArchive: () => TARGET_CATEGORY,
  mutateCar: (car, { sourceCategory }) => {
    const previousS403A = car.equipmentFeatures?.S403A ?? 'unknown';
    car.equipmentFeatures = car.equipmentFeatures || {};
    car.equipmentFeatures.S403A = 'no';
    car.overrideFeatures = car.overrideFeatures || {};
    car.overrideFeatures.S403A = {
      value: 'no',
      reason: 'Kullanıcı teyidi: sunroof yok'
    };
    pushAudit(
      car,
      `Dosya Taşıma: ${sourceCategory} → ${TARGET_CATEGORY}`,
      'Kullanıcı teyidi sonucu sunroof olmadığı tespit edildi',
      { 'equipmentFeatures.S403A': { from: previousS403A, to: 'no' } }
    );
  }
});

if (!result.found) {
  console.error(`Hata: "${id}" sunroof'lu aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`🔀 ${result.car.listingId} (${result.car.mobileDeId}) sunroof'suz olarak işaretlendi — ${result.sourceCategory} → ${TARGET_CATEGORY}`);
