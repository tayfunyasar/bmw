/* global process */
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
import { matchEquipmentFeatures } from './lib/equipment-match.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const dumpDir = path.resolve(__dirname, '../dump');
const equipmentRulesPath = path.resolve(__dirname, '../src/data/metadata/EQUIPMENT_RULES.json');

// enforce-listings.js'teki kanonik dosya listesiyle ayni (o dosyalar --fix ile
// sema/sira acisindan dogrulaniyor; burada da onlari tazeliyoruz).
const files = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_GAS_WITHOUT_SUNROOF.json',
  'COUPE_GAS_WITH_SUNROOF_SOLD.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'DELETED_CARS.json',
  'GRAN_COUPE.json',
  'CABRIO.json',
];

const isDry = process.argv.includes('--dry');
const equipmentRules = JSON.parse(fs.readFileSync(equipmentRulesPath, 'utf8'));

// Her mobileDeId icin en yeni dump dosyasini bul (flip-flop onleme).
function buildLatestDumps() {
  const latest = {};
  for (const filename of fs.readdirSync(dumpDir)) {
    if (!filename.endsWith('.json')) continue;
    const [id, tsRaw] = filename.replace('.json', '').split('_');
    if (!id) continue;
    const ts = parseInt(tsRaw) || 0;
    if (!latest[id] || ts > latest[id].ts) latest[id] = { ts, filename };
  }
  return latest;
}

const latestDumps = buildLatestDumps();

// Ozet sayaclar
const summary = {
  totalListings: 0,
  noDump: 0,
  deadDump: 0,
  updatedListings: 0,
  overrideSkips: 0,
  transitions: {}, // "unknown→no" gibi
};

function rematchListing(listing) {
  summary.totalListings++;
  const id = listing.mobileDeId;
  const dumpRef = id ? latestDumps[id] : null;
  if (!dumpRef) {
    summary.noDump++;
    return false;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dumpDir, dumpRef.filename), 'utf8'));
  } catch {
    summary.noDump++;
    return false;
  }
  if (raw.title === 'Listing does not exists anymore') {
    summary.deadDump++;
    return false;
  }

  const fresh = matchEquipmentFeatures(
    { description: raw.description || '', features: raw.features || [], props: raw.properties || {} },
    equipmentRules
  );

  const overrides = listing.overrideFeatures || {};
  listing.equipmentFeatures = listing.equipmentFeatures || {};

  let changed = false;
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

for (const file of files) {
  const filePath = path.join(listingsDir, file);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let fileChanged = false;
  for (const listing of data) {
    if (rematchListing(listing)) fileChanged = true;
  }

  if (fileChanged && !isDry) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`✍️  ${file} guncellendi`);
  } else if (fileChanged) {
    console.log(`(dry) ${file} degisecekti`);
  } else {
    console.log(`•  ${file} degismedi`);
  }
}

console.log('\n=== Ozet ===');
console.log(`Toplam ilan            : ${summary.totalListings}`);
console.log(`Guncellenen ilan       : ${summary.updatedListings}`);
console.log(`Dump'i olmayan (atlandi): ${summary.noDump}`);
console.log(`Kalkmis dump (atlandi) : ${summary.deadDump}`);
console.log(`Override korunan kod   : ${summary.overrideSkips}`);
console.log('Durum gecisleri:');
for (const [k, v] of Object.entries(summary.transitions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} : ${v}`);
}
if (isDry) console.log('\n(--dry: hicbir dosya yazilmadi)');
else console.log('\nBitti. Simdi calistir: npm run format:data');
