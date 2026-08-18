import { moveListing, pushAudit } from './lib/move-listing.js';

const CAKAL_CATEGORY = 'COUPE_GAS_WITH_SUNROOF_CAKAL';

const id = process.argv[2];
if (!id) {
  console.error('Kullanım: npm run move:cakal -- <mobileDeId | listingId>');
  process.exit(1);
}

const result = moveListing({
  id,
  pickArchive: () => CAKAL_CATEGORY,
  mutateCar: (car, { sourceCategory }) =>
    pushAudit(car, 'Çakal Kasa İşaretlendi', `${sourceCategory} dosyasından CAKAL olarak taşındı`)
});

if (!result.found) {
  console.error(`Hata: "${id}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`🐺 ${result.car.listingId} (${result.car.mobileDeId}) çakal kasaya taşındı — ${result.sourceCategory} → ${result.archive}`);
