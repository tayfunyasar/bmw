// Dislanan ulkelerden gelen ilanlari kendi kategorisine tasir (or. LT → LITHUANIA/).
//
// Config tek kaynak: src/data/metadata/LISTING_FILES.json → countryExcludedCategories.
// Yeni bir ulke dislamak icin YALNIZCA o JSON'a satir eklenir; burada kod degismez.
//
// Neden ayri script: parse-car-json.js yeni/guncellenen ilanlari dogru kategoriye
// yonlendirir ama SOLD / CAKAL / DELETED "frozen" oldugu icin oradakileri tasimaz.
// Bu script TUM kategorileri tarar — mevcut veriyi config ile hizalar, tekrar
// calistirilabilir (idempotent: tasinacak bir sey yoksa hicbir dosyaya dokunmaz).
//
// Kullanim:
//   node scripts/move-excluded-countries.js --dry   → sadece raporla
//   node scripts/move-excluded-countries.js         → uygula
// Sonrasinda: npm run format:data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { countryCodeFromLocation } from './lib/country.js';
import { pushAudit } from './lib/move-listing.js';
import { readCategory, moveCar } from './lib/listings-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_FILES = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8')
);
const EXCLUDED = LISTING_FILES.countryExcludedCategories || {};
const isDry = process.argv.includes('--dry');

const targets = new Set(Object.values(EXCLUDED));
const moved = [];

for (const category of LISTING_FILES.allCategories) {
  if (targets.has(category)) continue;             // hedef kategorinin kendisi taranmaz
  for (const car of readCategory(category)) {
    const code = countryCodeFromLocation(car.listingLocation);
    const target = code ? EXCLUDED[code] : null;
    if (!target) continue;

    moved.push({ listingId: car.listingId, mobileDeId: car.mobileDeId, code, from: category, to: target });
    if (!isDry) {
      pushAudit(car, 'Ülke Dışlaması', `${code} ülkesinden — ${category} → ${target} (kapsam dışı, arayüzde gösterilmez)`);
      moveCar(category, target, car);
    }
  }
}

console.log(`=== Ülke dışlaması: ${Object.entries(EXCLUDED).map(([c, t]) => `${c} → ${t}`).join(', ')} ===`);
if (moved.length === 0) {
  console.log('Taşınacak ilan yok — mevcut veri config ile zaten hizalı.');
} else {
  moved.forEach(m => console.log(`  ${isDry ? '(dry) ' : '🌍 '}${m.listingId} (${m.mobileDeId}) [${m.code}]  ${m.from} → ${m.to}`));
  console.log(`\nToplam ${moved.length} ilan taşındı.`);
}
if (isDry) console.log('\n(--dry: hiçbir dosya yazılmadı)');
else if (moved.length) console.log('\nBitti. Şimdi çalıştır: npm run format:data');
