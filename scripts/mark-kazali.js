import path from 'path';
import { moveListing, listingsDir, DEFAULT_SOURCE_FILES, pushAudit } from './lib/move-listing.js';

const coupeKazaliArchive = {
  path: path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_KAZALI.json'),
  name: 'COUPE_GAS_WITH_SUNROOF_KAZALI.json'
};
const granCoupeKazaliArchive = {
  path: path.join(listingsDir, 'GRAN_COUPE_KAZALI.json'),
  name: 'GRAN_COUPE_KAZALI.json'
};

function pickKazaliArchive(sourceFile) {
  return sourceFile === 'GRAN_COUPE.json' ? granCoupeKazaliArchive : coupeKazaliArchive;
}

const [id, ...reasonParts] = process.argv.slice(2);
if (!id) {
  console.error('Kullanım: npm run move:kazali -- <mobileDeId | listingId> [neden]');
  process.exit(1);
}
const reason = reasonParts.join(' ').trim() || 'Manuel işaretlendi';

const result = moveListing({
  id,
  sourceFiles: [...DEFAULT_SOURCE_FILES, 'CABRIO.json'],
  pickArchive: pickKazaliArchive,
  mutateCar: (car, { sourceFile, archive }) => {
    pushAudit(car, 'Kazalı İşaretlendi', `${sourceFile} dosyasından ${archive.name} dosyasına taşındı — ${reason}`);
    car.listingDescriptionNotes = car.listingDescriptionNotes || [];
    const note = `⚠️ KAZALI olarak işaretlendi — ${reason}`;
    if (!car.listingDescriptionNotes.includes(note)) {
      car.listingDescriptionNotes.push(note);
    }
  }
});

if (!result.found) {
  console.error(`Hata: "${id}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`💥 ${result.car.listingId} (${result.car.mobileDeId}) kazalı olarak taşındı — ${result.sourceFile} → ${result.archive.name} (${reason})`);
