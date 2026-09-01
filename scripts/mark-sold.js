import { moveListing, DEFAULT_SOURCE_CATEGORIES, dealerSourceCategories, dealerSoldArchiveFor } from './lib/move-listing.js';
import { LISTING_FILES } from './lib/listings-store.js';
import { pushSoldAudit } from './lib/sold.js';

const id = process.argv[2];
if (!id) {
  console.error('Kullanım: npm run move:sell -- <mobileDeId | listingId>');
  process.exit(1);
}

const result = moveListing({
  id,
  // Kok gövde kategorileri + ekstralar (cabrio/kazali, config: soldExtraSourceCategories)
  // + TUM bayi site kategorileri.
  sourceCategories: [
    ...DEFAULT_SOURCE_CATEGORIES,
    ...LISTING_FILES.soldExtraSourceCategories,
    ...dealerSourceCategories()
  ],
  pickArchive: (sourceCategory, car) => dealerSoldArchiveFor(sourceCategory, car),
  mutateCar: (car, { sourceCategory }) => pushSoldAudit(car, sourceCategory)
});

if (!result.found) {
  console.error(`Hata: "${id}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

console.log(`✅ ${result.car.listingId} (${result.car.mobileDeId}) satıldı — ${result.sourceCategory} → ${result.archive}`);
