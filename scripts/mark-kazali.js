import { moveListing, DEFAULT_SOURCE_CATEGORIES, pushAudit, KAZALI_AUDIT_ACTION, kazaliArchiveFor } from './lib/move-listing.js';

const [id, ...reasonParts] = process.argv.slice(2);
if (!id) {
  console.error('Kullanım: npm run move:kazali -- <mobileDeId | listingId> [neden]');
  process.exit(1);
}
const reason = reasonParts.join(' ').trim() || 'Manuel işaretlendi';

const result = moveListing({
  id,
  sourceCategories: [...DEFAULT_SOURCE_CATEGORIES, 'CABRIO'],
  pickArchive: kazaliArchiveFor,
  mutateCar: (car, { sourceCategory, archive }) => {
    pushAudit(car, KAZALI_AUDIT_ACTION, `${sourceCategory} dosyasından ${archive} dosyasına taşındı — ${reason}`);
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

console.log(`💥 ${result.car.listingId} (${result.car.mobileDeId}) kazalı olarak taşındı — ${result.sourceCategory} → ${result.archive} (${reason})`);
