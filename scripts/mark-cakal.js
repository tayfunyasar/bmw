import path from 'path';
import { moveListing, listingsDir, pushAudit } from './lib/move-listing.js';

const cakalArchive = {
  path: path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_CAKAL.json'),
  name: 'COUPE_GAS_WITH_SUNROOF_CAKAL.json'
};

const id = process.argv[2];
if (!id) {
  console.error('Kullanım: npm run move:cakal -- <mobileDeId | listingId>');
  process.exit(1);
}

const result = moveListing({
  id,
  pickArchive: () => cakalArchive,
  mutateCar: (car, { sourceFile }) =>
    pushAudit(car, 'Çakal Kasa İşaretlendi', `${sourceFile} dosyasından CAKAL olarak taşındı`)
});

if (!result.found) {
  console.error(`Hata: "${id}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`🐺 ${result.car.listingId} (${result.car.mobileDeId}) çakal kasaya taşındı — ${result.sourceFile} → ${result.archive.name}`);
