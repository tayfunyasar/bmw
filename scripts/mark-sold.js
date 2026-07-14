import path from 'path';
import { moveListing, listingsDir, DEFAULT_SOURCE_FILES } from './lib/move-listing.js';
import { pushSoldAudit } from './lib/sold.js';

const soldArchive = {
  path: path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_SOLD.json'),
  name: 'COUPE_GAS_WITH_SUNROOF_SOLD.json'
};

const id = process.argv[2];
if (!id) {
  console.error('Kullanım: npm run move:sell -- <mobileDeId | listingId>');
  process.exit(1);
}

const result = moveListing({
  id,
  sourceFiles: [...DEFAULT_SOURCE_FILES, 'CABRIO.json'],
  pickArchive: () => soldArchive,
  mutateCar: (car, { sourceFile }) => pushSoldAudit(car, sourceFile)
});

if (!result.found) {
  console.error(`Hata: "${id}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`✅ ${result.car.listingId} (${result.car.mobileDeId}) satıldı — ${result.sourceFile} → ${result.archive.name}`);
