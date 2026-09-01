#!/usr/bin/env node
// Re-list (yeniden ilan) temizligi — "uyaniklik" tespiti tek yerde, ELLE DEGIL.
//
// Desen (C729/C1145 vakasi, 2026-09-01): bayi ilani kapatip AYNI araci yeni mobileDeId
// ile yeniden yayinlar. Sonuc: (a) ayni arac iki kayit, (b) yeni kayitta ilan yasi
// SIFIRLANMIS gorunur, (c) eski kayit "satildi" sanilip arsive duser. `parse-car-json`
// bunu `possibleTwinOf` ile ISARETLER ama birlestirmez — birlestirme burasi.
//
// KANIT (uc kosul birlikte): (1) parmak izi ikizi = possibleTwinOf bagi,
// (2) satici AYNI (★ puani yok sayilir), (3) ikizin ilani OLU (en yeni dump "Listing
// does not exists anymore" ya da kayit *_SOLD arsivinde) ve bu kaydin ilani CANLI.
// Ucu birden saglanmiyorsa DOKUNULMAZ (kanit yoksa etiketleme).
//
// Birlestirme yonu: ESKI kayit (twin) KOK olarak kalir — gecmisi, audit'i ve gercek
// ilk yayin tarihi onda. Yeni ilanin mobileDeId/listingUrl/listingDates alanlari koke
// tasinir, yeni kayit SILINIR. Yas korumasi src/utils/listingAge.js'te (createdTime
// sifirlansa bile audit'teki ilk yayin tarihi kazanir).
//
// Kullanim:
//   node scripts/merge-relists.js --dry   → sadece raporla
//   node scripts/merge-relists.js         → uygula (sonra: npm run format:data)

import { allCategories, readCategory, writeCar, removeCar, moveCar } from './lib/listings-store.js';
import { buildDumpIndex, readLiveDump } from './lib/dumps.js';

const isDry = process.argv.includes('--dry');
const dumpIndex = buildDumpIndex();

// "★4.7" gibi puan ekleri ve noktalama satici kimligi degildir.
const normalizeSeller = (name) =>
  String(name || '').replace(/★\s*[\d.]+/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLocaleLowerCase('de-DE');

// Ilanin canli/olu durumu: dump yoksa "bilinmiyor" (karar verdirmez).
const adState = (mobileDeId) => {
  if (!mobileDeId) return 'unknown';
  const { raw, reason } = readLiveDump(mobileDeId, dumpIndex);
  if (raw) return 'alive';
  return reason === 'deadDump' ? 'dead' : 'unknown';
};

// Tum agac bellekte: listingId -> { car, category }
const index = new Map();
for (const category of allCategories()) {
  for (const car of readCategory(category)) index.set(car.listingId, { car, category });
}

const isArchived = (category) => /_SOLD$|^DELETED/.test(category);
// Govde/tahrik ailesi: arsiv ve hasar ekleri atilinca kalan taban kategori.
// Re-list AYNI fiziksel aractir → aile degisemez (C179 Coupé ← C964 Gran Coupé gibi
// bir "aday" gercek bir ikiz DEGILDIR, parmak izi carpismasidir).
const familyOf = (category) => String(category).replace(/_KAZALI/g, '').replace(/_SOLD$/, '');

const candidates = [];
const rejected = [];
for (const [listingId, { car, category }] of index) {
  if (!car.possibleTwinOf || isArchived(category)) continue;
  const twin = index.get(car.possibleTwinOf);
  if (!twin) { rejected.push({ listingId, why: `ikiz kaydi yok (${car.possibleTwinOf})` }); continue; }

  const sellerSame = normalizeSeller(car.sellerTypeOrName) === normalizeSeller(twin.car.sellerTypeOrName);
  const selfState = adState(car.mobileDeId);
  const twinState = adState(twin.car.mobileDeId);
  // Arsivde olmak TEK BASINA yeterli degil: gercekten satilmis AYRI bir arac da
  // arsivdedir. Sert kanit = ikizin ilaninin Apify'da OLU donmesi.
  const twinGone = twinState === 'dead';
  const sameFamily = familyOf(twin.category) === familyOf(category);

  if (sellerSame && sameFamily && twinGone && selfState === 'alive') {
    candidates.push({ newCar: car, newCategory: category, root: twin.car, rootCategory: twin.category, twinState });
  } else {
    rejected.push({
      listingId, twinOf: car.possibleTwinOf,
      why: !sellerSame ? 'satici FARKLI (muhtemelen ayri arac)'
        : !sameFamily ? `govde ailesi farkli (${familyOf(twin.category)} ≠ ${familyOf(category)}) — parmak izi carpismasi`
        : !twinGone ? `ikizin ilani olu degil (${twinState}${isArchived(twin.category) ? ', arsivde ama dump canli' : ''})`
        : `bu kaydin ilani canli degil (${selfState})`,
    });
  }
}

console.log(`Aday re-list: ${candidates.length} | dokunulmayan possibleTwinOf: ${rejected.length}`);
for (const c of candidates) {
  console.log(`  ${c.root.listingId} (${c.rootCategory}) ← ${c.newCar.listingId} (${c.newCategory}) — ${c.newCar.sellerTypeOrName} | ikiz durumu: ${c.twinState}`);
}

if (isDry) {
  console.log('\n(--dry: hicbir dosya yazilmadi)');
  process.exit(0);
}

for (const { newCar, newCategory, root, rootCategory } of candidates) {
  const changes = {
    mobileDeId: { old: root.mobileDeId, new: newCar.mobileDeId },
    listingUrl: { old: root.listingUrl, new: newCar.listingUrl },
  };
  root.mobileDeId = newCar.mobileDeId;
  root.listingUrl = newCar.listingUrl;
  root.listingDates = newCar.listingDates;      // ham veri: kayit artik YENI ilana bakiyor
  root.possibleTwinOf = null;
  root.auditHistory = root.auditHistory || [];
  root.auditHistory.push({
    action: 'Yeniden İlan (Re-list)',
    detail: `Aynı araç bayi tarafından yeni ilan olarak açıldı; ${newCar.listingId} kaydı bu köke birleştirildi (satıcı aynı, eski ilan mobile.de'den kalkmış). Gerçek ilan yaşı audit'teki ilk yayın tarihinden hesaplanır.`,
    changes,
    auditDate: new Date().toISOString(),
  });

  removeCar(newCategory, newCar.listingId);
  if (rootCategory !== newCategory) moveCar(rootCategory, newCategory, root);
  else writeCar(newCategory, root);
  console.log(`🔗 ${root.listingId} ← ${newCar.listingId} birleştirildi (${newCategory})`);
}

console.log(`\nBitti: ${candidates.length} re-list birleştirildi. Sonraki adım: npm run format:data`);
