// Mevcut kayitli ilanlarin equipmentFeatures'ini GUNCEL matcher mantigiyla
// yeniden turetir (unknown → no "guvenlik frenli" fallback dahil).
//
// Neden ayri script: kayitli ilanlarda ham description/features/props SAKLANMIYOR;
// yalnizca hesaplanmis equipmentFeatures var. Bu yuzden ham veriye (dump/*.json)
// donup matchEquipmentFeatures'i yeniden calistirmak gerekir. import:car'in
// dosya-tasima/audit yan etkilerini tetiklemeden SADECE equipmentFeatures'i tazeler.
//
// Koruma: overrideFeatures'ta tanimli kodlara (bayi-linki manuel cozumleri) dokunmaz
// — parse-car-json.js applyUpdatesAndGetChanges ile ayni mantik.
//
// Kullanim:
//   node scripts/rematch-equipment.js         → yaz
//   node scripts/rematch-equipment.js --dry    → sadece raporla, yazma
// Sonrasinda: npm run format:data (sema/sira sabitlenir).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { explainEquipmentFeatures } from './lib/equipment-match.js';
import { buildDumpIndex, readLiveDump } from './lib/dumps.js';
import { readCategory, writeCar } from './lib/listings-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const equipmentRulesPath = path.resolve(__dirname, '../src/data/metadata/EQUIPMENT_RULES.json');
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));

// Kanonik TAM kategori listesi (arsiv/cakal/kazali dahil) — tek kaynak LISTING_FILES.json.
// Burada hardcode liste TUTULMAZ: eskiden 9 dosya sayiliyordu ve CAKAL/KAZALI/
// GRAN_COUPE_KAZALI hic yeniden turetilmiyordu.
const categories = LISTING_FILES.allCategories;

const isDry = process.argv.includes('--dry');
const equipmentRules = JSON.parse(fs.readFileSync(equipmentRulesPath, 'utf8'));

const dumpIndex = buildDumpIndex();

// Ozet sayaclar
const summary = {
  totalListings: 0,
  noDump: 0,
  deadDump: 0,
  staleFallback: 0,
  updatedListings: 0,
  overrideSkips: 0,
  transitions: {}, // "unknown→no" gibi
};

function rematchListing(listing) {
  summary.totalListings++;
  // En yeni CANLI dump — en yeni dump "ilan kalkmis" bos kaydiysa daha eskisine duser.
  const { raw, reason, staleFallback } = readLiveDump(listing.mobileDeId, dumpIndex);
  if (!raw) {
    if (reason === 'deadDump') summary.deadDump++;
    else summary.noDump++;
    return false;
  }
  if (staleFallback) summary.staleFallback++;

  const freshExplained = explainEquipmentFeatures(
    { description: raw.description || '', features: raw.features || [], props: raw.properties || {} },
    equipmentRules
  );
  const fresh = Object.fromEntries(Object.entries(freshExplained).map(([c, v]) => [c, v.status]));

  const overrides = listing.overrideFeatures || {};
  listing.equipmentFeatures = listing.equipmentFeatures || {};

  let changed = false;
  // S403A karari (sunroof'lu/suz dosya ayrimi) GEREKCESIYLE kayda islenir —
  // dump'a donmeden final dosyadan okunabilir (drivetrainReason simetrisi).
  if (!overrides.S403A && freshExplained.S403A) {
    const reasonStr = `S403A=${freshExplained.S403A.status} — ${freshExplained.S403A.reason}`;
    if (listing.sunroofReason !== reasonStr) {
      listing.sunroofReason = reasonStr;
      summary.transitions['sunroofReason'] = (summary.transitions['sunroofReason'] || 0) + 1;
      changed = true;
    }
  }
  for (const [code, status] of Object.entries(fresh)) {
    if (overrides[code]) { summary.overrideSkips++; continue; } // manuel override korunur
    const old = listing.equipmentFeatures[code];
    if (old !== status) {
      const key = `${old ?? 'yok'}→${status}`;
      summary.transitions[key] = (summary.transitions[key] || 0) + 1;
      listing.equipmentFeatures[code] = status;
      changed = true;
    }
  }
  if (changed) summary.updatedListings++;
  return changed;
}

for (const category of categories) {
  let categoryChanged = false;
  for (const listing of readCategory(category)) {
    if (rematchListing(listing)) {
      categoryChanged = true;
      if (!isDry) writeCar(category, listing);   // yalniz degisen aracin dosyasi yazilir
    }
  }

  if (categoryChanged && !isDry) {
    console.log(`✍️  ${category} guncellendi`);
  } else if (categoryChanged) {
    console.log(`(dry) ${category} degisecekti`);
  } else {
    console.log(`•  ${category} degismedi`);
  }
}

console.log('\n=== Ozet ===');
console.log(`Toplam ilan            : ${summary.totalListings}`);
console.log(`Guncellenen ilan       : ${summary.updatedListings}`);
console.log(`Dump'i olmayan (atlandi): ${summary.noDump}`);
console.log(`Kalkmis dump (atlandi) : ${summary.deadDump}`);
console.log(`Eski canli dump'a dusen: ${summary.staleFallback}`);
console.log(`Override korunan kod   : ${summary.overrideSkips}`);
console.log('Durum gecisleri:');
for (const [k, v] of Object.entries(summary.transitions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} : ${v}`);
}
if (isDry) console.log('\n(--dry: hicbir dosya yazilmadi)');
else console.log('\nBitti. Simdi calistir: npm run format:data');
