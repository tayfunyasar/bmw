// Mevcut kayitli ilanlarin tahrik tipini (drivetrainType / drivetrainCertain)
// GUNCEL determineDrivetrain mantigiyla yeniden turetir ve gerekiyorsa ilani
// dogru dosyaya TASIR.
//
// Neden ayri script: kayitli ilanlarda ham title/description/features SAKLANMIYOR;
// yalnizca hesaplanmis alanlar var. Bu yuzden ham veriye (dump/*.json) donup
// determineDrivetrain'i yeniden calistirmak gerekir. rematch-equipment.js ile
// ayni desen; tahrik mantigi lib/drivetrain.js'ten gelir (kopyalanmaz).
//
// Koruma: overrideFeatures.drivetrainType olan ilanlara (kullanici teyidi) dokunmaz.
//
// Dosya tasimasi: (1) aktif 4 coupe dosyasi arasinda ROUTE ile; (2) SOLD arsivleri
// arasinda soldArchiveFor ile (satilmis RWD arac da dogru RWD SOLD dosyasinda olmali).
// CABRIO / GRAN_COUPE / DIZEL'de govde/yakit kurallari RWD'den ONCE geldigi icin tahrik
// o dosyalari etkilemez. CAKAL / KAZALI / DELETED donuktur: alanlari duzeltilir, tasinmaz.
//
// Kullanim:
//   node scripts/rematch-drivetrain.js --dry   → sadece raporla, yazma
//   node scripts/rematch-drivetrain.js         → uygula
// Sonrasinda: npm run format:data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { determineDrivetrainFromRaw, RWD } from './lib/drivetrain.js';
import { moveListing, pushAudit, soldArchiveFor, ALL_SOLD_CATEGORIES } from './lib/move-listing.js';
import { readCategory, writeCar } from './lib/listings-store.js';
import { buildDumpIndex, readLiveDump } from './lib/dumps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));

// Alanlari tazelenecek TUM kategoriler (arsivler dahil) — tek kaynak LISTING_FILES.json.
const ALL_CATEGORIES = LISTING_FILES.allCategories;

// Tahrik degisirse ilanin gitmesi gereken kategori (yalnizca bu 4'u arasinda tasima).
const ROUTE = {
  'COUPE_GAS_WITH_SUNROOF':        { [RWD]: 'COUPE_GAS_RWD_WITH_SUNROOF' },
  'COUPE_GAS_WITHOUT_SUNROOF':     { [RWD]: 'COUPE_GAS_RWD_WITHOUT_SUNROOF' },
  'COUPE_GAS_RWD_WITH_SUNROOF':    { 'xDrive AWD': 'COUPE_GAS_WITH_SUNROOF' },
  'COUPE_GAS_RWD_WITHOUT_SUNROOF': { 'xDrive AWD': 'COUPE_GAS_WITHOUT_SUNROOF' },
};

const isDry = process.argv.includes('--dry') || process.argv.includes('--dry-run');

const dumpIndex = buildDumpIndex();

// aiCommentary'de tahrikle ilgili eski uyarilari ayikla (diger notlar korunur).
const isDrivetrainNote = (note) => /tahrik|rear wheel drive|rwd sinyali/i.test(String(note));

const summary = { total: 0, noDump: 0, deadDump: 0, staleFallback: 0, overrideSkips: 0, fieldChanges: 0, moves: [] };

function freshDrivetrain(listing) {
  // En yeni CANLI dump — "ilan kalkmis" bos kaydi en yenisiyse daha eskisine duser.
  const { raw, reason, staleFallback } = readLiveDump(listing.mobileDeId, dumpIndex);
  if (!raw) {
    if (reason === 'deadDump') summary.deadDump++;
    else summary.noDump++;
    return null;
  }
  if (staleFallback) summary.staleFallback++;
  return determineDrivetrainFromRaw(raw, listing.vin);
}

// --- 1. gecis: alanlari tazele, tasinacaklari topla ---
for (const category of ALL_CATEGORIES) {
  let categoryChanged = false;
  for (const listing of readCategory(category)) {
    summary.total++;

    const override = listing.overrideFeatures?.drivetrainType;
    if (override) { summary.overrideSkips++; continue; }

    const fresh = freshDrivetrain(listing);
    if (!fresh) continue;

    const oldType = listing.drivetrainType;
    const oldCertain = listing.drivetrainCertain;
    const oldReason = listing.drivetrainReason;

    if (oldType !== fresh.type || oldCertain !== fresh.certain || oldReason !== fresh.reason) {
      summary.fieldChanges++;
      categoryChanged = true;
      listing.drivetrainType = fresh.type;
      listing.drivetrainCertain = fresh.certain;
      listing.drivetrainReason = fresh.reason;

      // Eski tahrik uyarisini temizle, gerekiyorsa yenisini ekle.
      // aiCommentary bazi kayitlarda duz string — diziye normalize et.
      const existing = Array.isArray(listing.aiCommentary)
        ? listing.aiCommentary
        : (listing.aiCommentary ? [listing.aiCommentary] : []);
      const others = existing.filter(n => !isDrivetrainNote(n));
      const notes = fresh.certain ? others : [...others, fresh.note];
      listing.aiCommentary = notes.length ? notes : null;
      if (!isDry) writeCar(category, listing);   // yalniz degisen aracin dosyasi yazilir
    }

    let target = ROUTE[category]?.[fresh.type];
    // SOLD arşivleri arası tutarlılık: satılmış araç da tahrik+sunroof'a göre doğru
    // SOLD kategorisinde olmalı (soldArchiveFor tek kaynak). listing.drivetrainType bu
    // noktada fresh.type'a eşit (yukarıda güncellendi ya da zaten eşitti).
    if (!target && ALL_SOLD_CATEGORIES.includes(category)) {
      const correctSold = soldArchiveFor(listing);
      if (correctSold !== category) target = correctSold;
    }
    if (target) {
      summary.moves.push({ id: listing.mobileDeId, listingId: listing.listingId, from: category, to: target, type: fresh.type });
    }
  }

  if (categoryChanged && !isDry) {
    console.log(`✍️  ${category} alanlari guncellendi`);
  } else if (categoryChanged) {
    console.log(`(dry) ${category} alanlari degisecekti`);
  }
}

// --- 2. gecis: dosya tasimalari (moveListing diskten taze okur) ---
for (const mv of summary.moves) {
  if (isDry) {
    console.log(`(dry) TASINACAK  ${mv.listingId} (${mv.id})  ${mv.from} → ${mv.to}   [${mv.type}]`);
    continue;
  }
  const result = moveListing({
    id: mv.id,
    sourceCategories: [mv.from],
    pickArchive: () => mv.to,
    mutateCar: (car) => pushAudit(car, 'Tahrik Tipi Düzeltildi', `${mv.type} tespit edildi — ${mv.from} → ${mv.to}`)
  });
  if (!result.found) { console.warn(`⚠️  ${mv.listingId} (${mv.id}) tasinamadi — kaynakta bulunamadi`); continue; }
  console.log(`🔀 ${mv.listingId} (${mv.id})  ${mv.from} → ${mv.to}   [${mv.type}]`);
}

console.log('\n=== Ozet ===');
console.log(`Toplam ilan             : ${summary.total}`);
console.log(`Alan degisen ilan       : ${summary.fieldChanges}`);
console.log(`Dosya degistiren ilan   : ${summary.moves.length}`);
console.log(`Override korunan (atlandi): ${summary.overrideSkips}`);
console.log(`Dump'i olmayan (atlandi): ${summary.noDump}`);
console.log(`Kalkmis dump (atlandi)  : ${summary.deadDump}`);
console.log(`Eski canli dump'a dusen : ${summary.staleFallback}`);
if (isDry) console.log('\n(--dry: hicbir dosya yazilmadi)');
else console.log('\nBitti. Simdi calistir: npm run format:data');
