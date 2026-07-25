import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { writeRunLog } from './lib/run-log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN || APIFY_TOKEN === 'your_apify_token_here') {
    console.error('Hata: APIFY_TOKEN tanımlanmamış. Lütfen .env dosyasını güncelleyin.');
    process.exit(1);
}

const client = new ApifyClient({
    token: APIFY_TOKEN,
});

const args = process.argv.slice(2)
    .flatMap(arg => arg.split(','))
    .map(s => s.trim())
    .filter(Boolean);

if (args.length === 0) {
    console.error('Lütfen en az bir mobile.de URL\'si veya İlan ID\'si sağlayın.');
    process.exit(1);
}

const urls = args.map(arg => {
    if (/^\d+$/.test(arg)) {
        return `https://suchen.mobile.de/fahrzeuge/details.html?id=${arg}`;
    }
    return arg;
});

// İstenen ID'ler (dönen carId ile aynı formatta) — log'da "hangisi çekilemedi" için.
const idFromUrl = (u) => {
    const m = String(u).match(/id=(\d+)/) || String(u).match(/\/(\d+)\.html/);
    return m ? m[1] : String(u);
};
const requestedIds = urls.map(idFromUrl);

// ivanvs/mobile-de-scraper tek run'da yalnizca `maxRecords` kadar kayit
// dondurur. Bu yuzden URL'leri parca parca (chunk) isleyip sonuclari
// biriktiriyoruz; boylece tek `import:apify` cagrisi herhangi bir sayida
// ilani cekebilir. CHUNK_SIZE, run basina gonderilen URL sayisidir ve
// maxRecords ona esitlenir.
const ACTOR_ID = 'ivanvs/mobile-de-scraper';
const CHUNK_SIZE = 20;

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function fetchCarData() {
    const dumpDir = path.resolve(__dirname, '../dump');
    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir, { recursive: true });
    }

    const timestamp = Date.now();
    const chunks = chunk(urls, CHUNK_SIZE);
    const newFiles = [];
    const fetchedIds = [];
    const chunkErrors = [];
    let fetched = 0;
    let failedChunks = 0;

    console.log(`\n--- Apify Actor: ${ACTOR_ID} ---`);
    console.log(`İşlenecek URL sayısı: ${urls.length} (${chunks.length} parça, parça başına ≤${CHUNK_SIZE})`);

    for (let i = 0; i < chunks.length; i++) {
        const batch = chunks[i];
        const input = {
            maxRecords: batch.length,
            urls: batch.map(u => ({ url: u })),
        };
        try {
            console.log(`\nParça ${i + 1}/${chunks.length} (${batch.length} URL) başlatılıyor...`);
            const run = await client.actor(ACTOR_ID).call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            if (items && items.length > 0) {
                items.forEach(item => {
                    const idMatch = item.url?.match(/id=(\d+)/) || item.url?.match(/\/(\d+)\.html/);
                    const carId = String(item.id || (idMatch ? idMatch[1] : 'unknown'));
                    const filename = `${carId}_${timestamp}.json`;
                    fs.writeFileSync(path.join(dumpDir, filename), JSON.stringify(item, null, 2));
                    newFiles.push(filename);
                    fetchedIds.push(carId);
                });
                fetched += items.length;
                console.log(`Parça ${i + 1}: ${items.length} araç verisi çekildi.`);
            } else {
                console.warn(`Parça ${i + 1}: veri bulunamadı.`);
                chunkErrors.push({ chunk: i + 1, ids: batch.map(idFromUrl), error: 'Apify boş sonuç döndürdü (veri bulunamadı)' });
            }
        } catch (error) {
            failedChunks++;
            console.error(`Parça ${i + 1} hatası:`, error.message);
            chunkErrors.push({ chunk: i + 1, ids: batch.map(idFromUrl), error: error.message });
        }
    }

    // İstenip de dönmeyen ID'ler = çekilemeyenler (403/session error/ilan kalkmış).
    const missingIds = requestedIds.filter(id => !fetchedIds.includes(id));
    const logFile = writeRunLog('apify', {
        actor: ACTOR_ID,
        requestedCount: requestedIds.length,
        fetchedCount: fetchedIds.length,
        missingCount: missingIds.length,
        requestedIds,
        fetchedIds,
        missingIds,
        chunkErrors,
    });
    if (missingIds.length > 0) {
        console.warn(`\n⚠️  Çekilemeyen ${missingIds.length} ilan: ${missingIds.join(', ')}`);
    }
    console.log(`📝 Apify log: ${path.relative(path.resolve(__dirname, '..'), logFile)}`);

    if (newFiles.length === 0) {
        console.error('\nMaalesef hiçbir araç verisi çekilemedi.');
        process.exit(1);
    }

    // İşlenecek dosyaların listesini gecici bir dosyaya yaz (sadece dosya adları)
    fs.writeFileSync(path.join(dumpDir, '.latest_import'), newFiles.join('\n'));

    console.log(`\nBaşarılı! Toplam ${fetched} araç verisi çekildi (${chunks.length - failedChunks}/${chunks.length} parça başarılı).`);
    if (failedChunks > 0) {
        console.warn(`Uyarı: ${failedChunks} parça başarısız oldu, bu parçalardaki ilanlar çekilemedi.`);
    }
    console.log(`Ham veriler 'dump/' klasörüne kaydedildi.`);
}

fetchCarData();
