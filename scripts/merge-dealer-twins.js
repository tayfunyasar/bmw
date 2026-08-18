#!/usr/bin/env node
// possibleTwinOf tasiyan bayi kayitlarini tarar; ikizinin SATICISI da eslesiyorsa
// (sellerMatches) kaydi mobile.de kaydiyla BIRLESTIRIR ve site klasorunden siler.
// Satici eslesmeyenler dokunulmadan kalir (celiski tablosu gostermeye devam eder).
//
// Ne zaman gerekir: merge kurali eklenmeden once import edilmis kayitlar, ya da
// kullanici bayi teyidi sonrasi toplu temizlik. Idempotent — birlesecek sey yoksa
// hicbir dosyaya dokunmaz.
//
// Kullanim:
//   node scripts/merge-dealer-twins.js --dry   → sadece raporla
//   node scripts/merge-dealer-twins.js         → uygula (sonra: npm run format:data)

import path from 'path';
import { rootCategories, dealerCategories, readCategory, writeCar, removeCar } from './lib/listings-store.js';
import { sellerMatches } from './lib/dealer-sites.js';
import { hasReliableFingerprint } from './lib/twin-fingerprint.js';
import { mergeTwinIntoRoot } from './lib/merge-twin.js';

const isDry = process.argv.includes('--dry');

// Tum agac bellekte: kategori -> arac listesi (kok + bayi).
const tree = new Map();
for (const category of [...rootCategories(), ...dealerCategories()]) {
  tree.set(category, readCategory(category));
}

// Kok (mobile.de) kayitlarin dizini: listingId -> { car, category }
const rootIndex = new Map();
for (const [category, cars] of tree) {
  if (category.includes(path.sep)) continue; // yalniz kok kategoriler
  for (const car of cars) rootIndex.set(car.listingId, { car, category });
}

const summary = { merged: [], keptDifferentSeller: [], orphanTwin: [], invalidCleared: [] };

// --- Gecersiz bag supurme: sifir/tescilsiz araclarda imza ayirt edici degildir ---
// (C941/C753 vakasi). Bag ancak IKI taraf da guvenilir imzaliysa anlamli; degilse
// possibleTwinOf + ikiz notu temizlenir. Kural duzeltildigi icin yenisi uretilmez.
const allCars = new Map();
for (const cars of tree.values()) for (const car of cars) allCars.set(car.listingId, car);

for (const [category, cars] of tree) {
  for (const car of cars) {
    if (!car.possibleTwinOf) continue;
    const target = allCars.get(car.possibleTwinOf);
    const valid = hasReliableFingerprint(car) && target && hasReliableFingerprint(target);
    if (valid) continue;
    summary.invalidCleared.push({ id: car.listingId, was: car.possibleTwinOf });
    if (!isDry) {
      delete car.possibleTwinOf;
      if (Array.isArray(car.listingDescriptionNotes)) {
        car.listingDescriptionNotes = car.listingDescriptionNotes.filter(n => !/ikiz/i.test(n));
      }
      writeCar(category, car);
    }
  }
}

const dirtyRoots = new Set();

for (const [category, cars] of tree) {
  if (!category.includes(path.sep)) continue; // yalniz site kategorileri
  for (const car of cars) {
    if (!car.possibleTwinOf) continue;
    const root = rootIndex.get(car.possibleTwinOf);
    if (!root) { summary.orphanTwin.push({ id: car.listingId, twin: car.possibleTwinOf }); continue; }

    // Bayi kaydinin ham satici adi sellerTypeOrName'de ("WELLER Hildesheim" gibi).
    if (!sellerMatches(car.sellerTypeOrName, root.car.sellerTypeOrName)) {
      summary.keptDifferentSeller.push({ id: car.listingId, twin: car.possibleTwinOf, sellers: `"${car.sellerTypeOrName}" vs "${root.car.sellerTypeOrName}"` });
      continue;
    }

    const changes = mergeTwinIntoRoot(root.car, {
      dealerListingUrl: car.dealerListingUrl,
      vin: car.vin,
      freshEquipment: car.equipmentFeatures,   // site kaydi zaten parseRaw ciktisi
      source: category.split(path.sep)[0],
    });
    dirtyRoots.add(root);
    summary.merged.push({ id: car.listingId, into: car.possibleTwinOf, changes: Object.keys(changes).length });
    // Birlesen bayi kaydinin dosyasi silinir; bosalan kategori klasoru rmdir'lenir.
    if (!isDry) removeCar(category, car.listingId);
  }
}

if (!isDry) {
  for (const root of dirtyRoots) writeCar(root.category, root.car);
}

if (summary.invalidCleared.length) console.log(`${isDry ? '(dry) ' : ''}Geçersiz bağ temizlendi (güvenilmez imza): ${summary.invalidCleared.length} — ${summary.invalidCleared.slice(0, 8).map(x => x.id + '↛' + x.was).join(' ')}${summary.invalidCleared.length > 8 ? ' …' : ''}`);
console.log(`${isDry ? '(dry) ' : ''}Birleştirilen: ${summary.merged.length}`);
summary.merged.forEach(m => console.log(`  🔗 ${m.id} → ${m.into} (${m.changes} alan)`));
if (summary.keptDifferentSeller.length) {
  console.log(`Satıcı farklı, AYRI kaldı: ${summary.keptDifferentSeller.length}`);
  summary.keptDifferentSeller.forEach(k => console.log(`  ⚠️ ${k.id} ↔ ${k.twin}  ${k.sellers}`));
}
if (summary.orphanTwin.length) console.log(`İkizi bulunamayan: ${summary.orphanTwin.map(o => o.id).join(', ')}`);
if (!isDry && summary.merged.length) console.log('\nŞimdi çalıştır: npm run format:data');
