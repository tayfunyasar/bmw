import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { writeRunLog } from './lib/run-log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listingsDir = path.resolve(__dirname, '../src/data/listings');
const dumpDir = path.resolve(__dirname, '../dump');

const argv = process.argv.slice(2);
// --list: Apify'i çağırmadan sadece stale ilan ID'lerini yazdır ve çık.
// Refresh sonrası hâlâ stale kalanlar = veri çekilemeyen (403) ilanlardır.
const LIST_ONLY = argv.includes('--list');
const STALE_DAYS = parseInt(argv.find(a => /^\d+$/.test(a))) || 3;
const staleCutoff = Date.now() - (STALE_DAYS * 24 * 60 * 60 * 1000);

const activeFiles = [
  'COUPE_GAS_WITH_SUNROOF.json',
];

const allIds = activeFiles.flatMap(f => {
  const filePath = path.join(listingsDir, f);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')).map(c => c.mobileDeId).filter(Boolean);
});

// Her mobileDeId için son crawl (dump) timestamp'ini derle.
const buildDumpMap = () => {
  const map = {};
  for (const f of fs.readdirSync(dumpDir)) {
    if (!f.endsWith('.json')) continue;
    const [id, tsRaw] = f.replace('.json', '').split('_');
    const ts = parseInt(tsRaw);
    if (!id) continue;
    if (!map[id] || ts > map[id]) map[id] = ts;
  }
  return map;
};
const dumpMap = buildDumpMap();

// Dump'ı olmayan veya 3+ gün önce taranmış ilanları bul
const staleIds = allIds.filter(id => !dumpMap[id] || dumpMap[id] < staleCutoff);

if (LIST_ONLY) {
  staleIds.forEach(id => console.log(id));
  process.exit(0);
}

if (staleIds.length === 0) {
  console.log(`Tüm ilanlar son ${STALE_DAYS} gün içinde taranmış. Yapılacak bir şey yok.`);
  process.exit(0);
}

const BATCH_SIZE = 20;
const batches = [];
for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
  batches.push(staleIds.slice(i, i + BATCH_SIZE));
}

console.log(`${staleIds.length} ilan ${STALE_DAYS}+ gündür taranmamış. ${batches.length} batch halinde Apify başlatılıyor...\n`);

const startTime = Date.now();
const batchResults = [];
for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  console.log(`\n=== Batch ${i + 1}/${batches.length} (${batch.length} ilan) ===\n`);
  try {
    const argsString = batch.map(a => `"${a}"`).join(' ');
    execSync(`node scripts/import-full.js ${argsString}`, { stdio: 'inherit' });
    batchResults.push({ batch: i + 1, ids: batch, ok: true });
  } catch {
    console.error(`\nBatch ${i + 1} hata verdi, devam ediliyor...`);
    batchResults.push({ batch: i + 1, ids: batch, ok: false });
  }
}

// Refresh sonrası: hangi stale ilan için TAZE dump geldi (başarılı) vs gelmedi (403/çekilemedi).
const afterMap = buildDumpMap();
const refreshedIds = staleIds.filter(id => afterMap[id] && afterMap[id] >= startTime);
const stillStaleIds = staleIds.filter(id => !refreshedIds.includes(id));

const logFile = writeRunLog('refresh', {
  staleDays: STALE_DAYS,
  staleCount: staleIds.length,
  refreshedCount: refreshedIds.length,
  stillStaleCount: stillStaleIds.length,
  staleIds,
  refreshedIds,
  stillStaleIds,      // ← çekilemeyenler; C692 gibi km'si güncellenmeyen ilanlar burada
  batchResults,
});

console.log(`\n=== Refresh Özeti ===`);
console.log(`Stale ilan            : ${staleIds.length}`);
console.log(`Yenilenen (taze dump) : ${refreshedIds.length}`);
console.log(`Çekilemeyen (403 vb.) : ${stillStaleIds.length}${stillStaleIds.length ? ' → ' + stillStaleIds.join(', ') : ''}`);
console.log(`📝 Refresh log: ${path.relative(path.resolve(__dirname, '..'), logFile)}`);
