import { moveListing, DEFAULT_SOURCE_FILES, soldArchiveFor } from './lib/move-listing.js';
import { pushSoldAudit } from './lib/sold.js';

const id = process.argv[2];
if (!id) {
  console.error('Kullanım: npm run move:sell -- <mobileDeId | listingId>');
  process.exit(1);
}

const result = moveListing({
  id,
  sourceFiles: [...DEFAULT_SOURCE_FILES, 'CABRIO.json'],
  pickArchive: (sourceFile, car) => soldArchiveFor(car),
  mutateCar: (car, { sourceFile }) => pushSoldAudit(car, sourceFile)
});

if (!result.found) {
  console.error(`Hata: "${id}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`✅ ${result.car.listingId} (${result.car.mobileDeId}) satıldı — ${result.sourceFile} → ${result.archive.name}`);
