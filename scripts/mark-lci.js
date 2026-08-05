// Bir ilanin nesli (LCI / Pre-LCI) kullanici teyidiyle sabitlenir.
//
// Neden gerekli: G22 LCI gecisi TESCILDEN kesin ayrilamaz — 2023/01-05 araliginda
// iki nesil birlikte tescil edildi. parse-car-json.js bu araliktaki araclari
// "Pre-LCI + certain:false" kabul eder (UI'da ⚠️ LCI? rozeti). Foto/bayi teyidi
// gelince bu varsayim elle ezilir.
//
// Kalicilik: overrideFeatures.modelGeneration yazilir — kodda manuel kararlarin
// standart korunma yeri (bkz. applyUpdatesAndGetChanges). modelGeneration su an
// fieldsToCheck'te degil, ama ileride eklenirse teyit yine ezilmez.
//
// Kullanim:
//   npm run move:lci -- C45            → LCI olarak teyit et
//   npm run move:lci -- C45 Pre-LCI    → Pre-LCI olarak teyit et
//   npm run move:lci -- 443616047      → mobileDeId ile de calisir

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listingsDir } from './lib/move-listing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_FILES = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8')
);

const VALID_GENERATIONS = ['LCI', 'Pre-LCI'];

const [id, generationArg, ...reasonParts] = process.argv.slice(2);
if (!id) {
  console.error('Kullanım: npm run move:lci -- <mobileDeId | listingId> [LCI|Pre-LCI] [neden]');
  process.exit(1);
}

// Ikinci arguman nesil DEGILSE onu da nedenin parcasi say (nesil varsayilan LCI).
const generation = VALID_GENERATIONS.includes(generationArg) ? generationArg : 'LCI';
const reasonWords = VALID_GENERATIONS.includes(generationArg) ? reasonParts : [generationArg, ...reasonParts];
const reason = reasonWords.filter(Boolean).join(' ').trim() || 'Kullanıcı teyidi';

let hit = null;
for (const file of LISTING_FILES.allFiles) {
  const filePath = path.join(listingsDir, file);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data)) continue;
  const car = data.find(c => c.listingId === id || String(c.mobileDeId) === String(id));
  if (car) { hit = { car, data, filePath, file }; break; }
}

if (!hit) {
  console.error(`Hata: "${id}" hiçbir ilan dosyasında bulunamadı.`);
  process.exit(1);
}

const { car, data, filePath, file } = hit;
const before = { generation: car.modelGeneration, certain: car.modelGenerationCertain };

if (before.generation === generation && before.certain === true) {
  console.log(`ℹ️  ${car.listingId} (${car.mobileDeId}) zaten teyitli ${generation} — değişiklik yok.`);
  process.exit(0);
}

const [regYear, regMonth] = car.firstRegistrationYearAndMonth || [];
const regLabel = regYear != null && regMonth != null
  ? `${String(regMonth).padStart(2, '0')}/${regYear}`
  : '?';

car.modelGeneration = generation;
car.modelGenerationCertain = true;
car.overrideFeatures = car.overrideFeatures || {};
car.overrideFeatures.modelGeneration = {
  value: generation,
  reason: `${reason} (tescil ${regLabel}, otomatik ${before.generation} varsayılmıştı)`,
};
car.auditHistory = car.auditHistory || [];
car.auditHistory.push({
  action: 'Nesil Teyidi',
  detail: `${reason} — ${generation} (tescil ${regLabel})`,
  changes: {
    modelGeneration: { old: before.generation, new: generation },
    modelGenerationCertain: { old: before.certain, new: true },
  },
  auditDate: new Date().toISOString(),
});
car.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`🔥 ${car.listingId} (${car.mobileDeId}) → ${generation} teyitli — ${file.replace(/\.json$/, '')} (tescil ${regLabel}, önce: ${before.generation}/certain:${before.certain})`);
