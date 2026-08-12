#!/usr/bin/env node
// possibleTwinOf tasiyan bayi kayitlarini tarar; ikizinin SATICISI da eslesiyorsa
// (sellerMatches) kaydi mobile.de kaydiyla BIRLESTIRIR ve site dosyasindan siler.
// Satici eslesmeyenler dokunulmadan kalir (celiski tablosu gostermeye devam eder).
//
// Ne zaman gerekir: merge kurali eklenmeden once import edilmis kayitlar, ya da
// kullanici bayi teyidi sonrasi toplu temizlik. Idempotent — birlesecek sey yoksa
// hicbir dosyaya dokunmaz.
//
// Kullanim:
//   node scripts/merge-dealer-twins.js --dry   → sadece raporla
//   node scripts/merge-dealer-twins.js         → uygula (sonra: npm run format:data)

import fs from 'fs';
import path from 'path';
import { listingsDir, walkListingFiles } from './lib/listing-id.js';
import { sellerMatches } from './lib/dealer-sites.js';
import { mergeTwinIntoRoot } from './lib/merge-twin.js';

const isDry = process.argv.includes('--dry');

// Kok (mobile.de) kayitlarin dizini: listingId -> { car, file }
const rootIndex = new Map();
for (const file of walkListingFiles()) {
  if (path.relative(listingsDir, file).includes(path.sep)) continue; // yalniz kok dosyalar
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) continue;
  for (const car of data) rootIndex.set(car.listingId, { car, file, data });
}

const summary = { merged: [], keptDifferentSeller: [], orphanTwin: [] };
const dirtyRootFiles = new Set();

for (const file of walkListingFiles()) {
  const rel = path.relative(listingsDir, file);
  if (!rel.includes(path.sep)) continue; // yalniz site klasorleri
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) continue;

  const kept = [];
  let changed = false;
  for (const car of data) {
    if (!car.possibleTwinOf) { kept.push(car); continue; }
    const root = rootIndex.get(car.possibleTwinOf);
    if (!root) { summary.orphanTwin.push({ id: car.listingId, twin: car.possibleTwinOf }); kept.push(car); continue; }

    // Bayi kaydinin ham satici adi sellerTypeOrName'de ("WELLER Hildesheim" gibi).
    if (!sellerMatches(car.sellerTypeOrName, root.car.sellerTypeOrName)) {
      summary.keptDifferentSeller.push({ id: car.listingId, twin: car.possibleTwinOf, sellers: `"${car.sellerTypeOrName}" vs "${root.car.sellerTypeOrName}"` });
      kept.push(car);
      continue;
    }

    const changes = mergeTwinIntoRoot(root.car, {
      dealerListingUrl: car.dealerListingUrl,
      vin: car.vin,
      freshEquipment: car.equipmentFeatures,   // site kaydi zaten parseRaw ciktisi
      source: rel.split(path.sep)[0],
    });
    dirtyRootFiles.add(root.file);
    summary.merged.push({ id: car.listingId, into: car.possibleTwinOf, changes: Object.keys(changes).length });
    changed = true; // kayit silindi
  }

  if (changed && !isDry) {
    if (kept.length === 0) fs.rmSync(file);
    else fs.writeFileSync(file, JSON.stringify(kept, null, 2) + '\n');
  }
}

if (!isDry) {
  for (const file of dirtyRootFiles) {
    const { data } = [...rootIndex.values()].find(r => r.file === file);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

console.log(`${isDry ? '(dry) ' : ''}Birleştirilen: ${summary.merged.length}`);
summary.merged.forEach(m => console.log(`  🔗 ${m.id} → ${m.into} (${m.changes} alan)`));
if (summary.keptDifferentSeller.length) {
  console.log(`Satıcı farklı, AYRI kaldı: ${summary.keptDifferentSeller.length}`);
  summary.keptDifferentSeller.forEach(k => console.log(`  ⚠️ ${k.id} ↔ ${k.twin}  ${k.sellers}`));
}
if (summary.orphanTwin.length) console.log(`İkizi bulunamayan: ${summary.orphanTwin.map(o => o.id).join(', ')}`);
if (!isDry && summary.merged.length) console.log('\nŞimdi çalıştır: npm run format:data');
