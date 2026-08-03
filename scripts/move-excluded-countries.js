// Dislanan ulkelerden gelen ilanlari kendi dosyasina tasir (or. LT → LITHUANIA.json).
//
// Config tek kaynak: src/data/metadata/LISTING_FILES.json → countryExcludedFiles.
// Yeni bir ulke dislamak icin YALNIZCA o JSON'a satir eklenir; burada kod degismez.
//
// Neden ayri script: parse-car-json.js yeni/guncellenen ilanlari dogru dosyaya
// yonlendirir ama SOLD / CAKAL / DELETED "frozen" oldugu icin oradakileri tasimaz.
// Bu script TUM dosyalari tarar — mevcut veriyi config ile hizalar, tekrar
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
import { listingsDir, pushAudit } from './lib/move-listing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_FILES = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8')
);
const EXCLUDED = LISTING_FILES.countryExcludedFiles || {};
const isDry = process.argv.includes('--dry');

const targets = new Set(Object.values(EXCLUDED));
const readListings = (file) => {
  const filePath = path.join(listingsDir, file);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
};

// Hedef dosyalari bir kez oku; kaynaklardan cikanlar buraya eklenir.
const targetData = Object.fromEntries([...targets].map(file => [file, readListings(file)]));
const dirty = new Set();
const moved = [];

for (const file of LISTING_FILES.allFiles) {
  if (targets.has(file)) continue;                 // hedef dosyanin kendisi taranmaz
  const data = readListings(file);
  if (!Array.isArray(data) || data.length === 0) continue;

  const keep = [];
  for (const car of data) {
    const code = countryCodeFromLocation(car.listingLocation);
    const targetFile = code ? EXCLUDED[code] : null;
    if (!targetFile) { keep.push(car); continue; }

    pushAudit(car, 'Ülke Dışlaması', `${code} ülkesinden — ${file} → ${targetFile} (kapsam dışı, arayüzde gösterilmez)`);
    targetData[targetFile].push(car);
    moved.push({ listingId: car.listingId, mobileDeId: car.mobileDeId, code, from: file, to: targetFile });
    dirty.add(file);
    dirty.add(targetFile);
  }
  if (dirty.has(file) && !isDry) {
    fs.writeFileSync(path.join(listingsDir, file), JSON.stringify(keep, null, 2) + '\n', 'utf8');
  }
}

if (!isDry) {
  for (const file of dirty) {
    if (!targets.has(file)) continue;
    fs.writeFileSync(path.join(listingsDir, file), JSON.stringify(targetData[file], null, 2) + '\n', 'utf8');
  }
}

console.log(`=== Ülke dışlaması: ${Object.entries(EXCLUDED).map(([c, f]) => `${c} → ${f}`).join(', ')} ===`);
if (moved.length === 0) {
  console.log('Taşınacak ilan yok — mevcut veri config ile zaten hizalı.');
} else {
  moved.forEach(m => console.log(`  ${isDry ? '(dry) ' : '🌍 '}${m.listingId} (${m.mobileDeId}) [${m.code}]  ${m.from.replace(/\.json$/, '')} → ${m.to.replace(/\.json$/, '')}`));
  console.log(`\nToplam ${moved.length} ilan taşındı.`);
}
if (isDry) console.log('\n(--dry: hiçbir dosya yazılmadı)');
else if (moved.length) console.log('\nBitti. Şimdi çalıştır: npm run format:data');
