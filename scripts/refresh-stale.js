import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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

// Dump dosyalarından son crawl tarihini bul
const dumpFiles = fs.readdirSync(dumpDir).filter(f => f.endsWith('.json'));
const dumpMap = {};
for (const f of dumpFiles) {
  const [id, tsRaw] = f.replace('.json', '').split('_');
  const ts = parseInt(tsRaw);
  if (!dumpMap[id] || ts > dumpMap[id]) dumpMap[id] = ts;
}

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

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  console.log(`\n=== Batch ${i + 1}/${batches.length} (${batch.length} ilan) ===\n`);
  try {
    const argsString = batch.map(a => `"${a}"`).join(' ');
    execSync(`node scripts/import-full.js ${argsString}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\nBatch ${i + 1} hata verdi, devam ediliyor...`);
  }
}
