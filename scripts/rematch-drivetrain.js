/* global process */
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
// Dosya tasimasi YALNIZCA tahrikin routing'i belirledigi 4 coupe dosyasi arasinda
// yapilir. CABRIO / GRAN_COUPE / DIZEL'de govde-stili ve yakit kurallari
// parse-car-json.js:determineTargetFile icinde RWD kontrolunden ONCE geldigi icin
// tahrik o dosyalari etkilemez. Arsivler (SOLD / CAKAL / KAZALI / DELETED) donuktur:
// alanlari duzeltilir ama tasinmazlar.
//
// Kullanim:
//   node scripts/rematch-drivetrain.js --dry   → sadece raporla, yazma
//   node scripts/rematch-drivetrain.js         → uygula
// Sonrasinda: npm run format:data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { determineDrivetrainFromRaw, RWD } from './lib/drivetrain.js';
import { moveListing, pushAudit, listingsDir } from './lib/move-listing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpDir = path.resolve(__dirname, '../dump');

// Alanlari tazelenecek TUM dosyalar (arsivler dahil).
const ALL_FILES = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_GAS_WITHOUT_SUNROOF.json',
  'COUPE_GAS_WITH_SUNROOF_SOLD.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'COUPE_GAS_WITH_SUNROOF_CAKAL.json',
  'COUPE_GAS_WITH_SUNROOF_KAZALI.json',
  'DELETED_CARS.json',
  'GRAN_COUPE.json',
  'GRAN_COUPE_KAZALI.json',
  'CABRIO.json',
];

// Tahrik degisirse ilanin gitmesi gereken dosya (yalnizca bu 4'u arasinda tasima).
const ROUTE = {
  'COUPE_GAS_WITH_SUNROOF.json':        { [RWD]: 'COUPE_GAS_RWD_WITH_SUNROOF.json' },
  'COUPE_GAS_WITHOUT_SUNROOF.json':     { [RWD]: 'COUPE_GAS_RWD_WITHOUT_SUNROOF.json' },
  'COUPE_GAS_RWD_WITH_SUNROOF.json':    { 'xDrive AWD': 'COUPE_GAS_WITH_SUNROOF.json' },
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json': { 'xDrive AWD': 'COUPE_GAS_WITHOUT_SUNROOF.json' },
};

const isDry = process.argv.includes('--dry') || process.argv.includes('--dry-run');

// Her mobileDeId icin en yeni dump (flip-flop onleme) — rematch-equipment.js ile ayni.
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

// aiCommentary'de tahrikle ilgili eski uyarilari ayikla (diger notlar korunur).
const isDrivetrainNote = (note) => /tahrik|rear wheel drive|rwd sinyali/i.test(String(note));

const summary = { total: 0, noDump: 0, deadDump: 0, overrideSkips: 0, fieldChanges: 0, moves: [] };

function freshDrivetrain(listing) {
  const id = listing.mobileDeId;
  const dumpRef = id ? latestDumps[id] : null;
  if (!dumpRef) { summary.noDump++; return null; }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dumpDir, dumpRef.filename), 'utf8'));
  } catch { summary.noDump++; return null; }
  if (raw.title === 'Listing does not exists anymore') { summary.deadDump++; return null; }
  return determineDrivetrainFromRaw(raw);
}

// --- 1. gecis: alanlari tazele, tasinacaklari topla ---
for (const file of ALL_FILES) {
  const filePath = path.join(listingsDir, file);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let fileChanged = false;
  for (const listing of data) {
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
      fileChanged = true;
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
    }

    const target = ROUTE[file]?.[fresh.type];
    if (target) {
      summary.moves.push({ id: listing.mobileDeId, listingId: listing.listingId, from: file, to: target, type: fresh.type });
    }
  }

  if (fileChanged && !isDry) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`✍️  ${file} alanlari guncellendi`);
  } else if (fileChanged) {
    console.log(`(dry) ${file} alanlari degisecekti`);
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
    sourceFiles: [mv.from],
    pickArchive: () => ({ path: path.join(listingsDir, mv.to), name: mv.to }),
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
if (isDry) console.log('\n(--dry: hicbir dosya yazilmadi)');
else console.log('\nBitti. Simdi calistir: npm run format:data');
