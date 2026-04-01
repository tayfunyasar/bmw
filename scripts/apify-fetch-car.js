import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN || APIFY_TOKEN === 'your_apify_token_here') {
    console.error('Hata: APIFY_TOKEN tanımlanmamış. Lütfen .env dosyasını güncelleyin.');
    process.exit(1);
}

const carJsonPath = path.resolve(__dirname, '../car.json');

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

async function fetchCarData() {
    // ivanvs/mobile-de-scraper için çoklu URL desteği ve maxRecords 20
    const actors = [
        { 
            id: 'ivanvs/mobile-de-scraper', 
            input: { 
                "maxRecords": 20,
                "urls": urls.map(u => ({ "url": u }))
            } 
        }
    ];

    for (const actor of actors) {
        try {
            console.log(`\n--- Apify Actor Deneniyor: ${actor.id} ---`);
            console.log(`İşlenecek URL sayısı: ${urls.length}`);

            console.log(`Actor ${actor.id} başlatılıyor...`);
            const run = await client.actor(actor.id).call(actor.input);

            console.log('Veriler indiriliyor...');
            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            if (items && items.length > 0) {
                // Dump klasörünü oluştur ve her bir yanıtı ayrı ayrı kaydet
                const dumpDir = path.resolve(__dirname, '../dump');
                if (!fs.existsSync(dumpDir)) {
                    fs.mkdirSync(dumpDir, { recursive: true });
                }

                const timestamp = Date.now();
                const newFiles = [];
                items.forEach(item => {
                    const idMatch = item.url?.match(/id=(\d+)/) || item.url?.match(/\/(\d+)\.html/);
                    const carId = item.id || (idMatch ? idMatch[1] : 'unknown');
                    const filename = `${carId}_${timestamp}.json`;
                    const dumpFilePath = path.join(dumpDir, filename);
                    fs.writeFileSync(dumpFilePath, JSON.stringify(item, null, 2));
                    newFiles.push(filename);
                });

                // İşlenecek dosyaların listesini gecici bir dosyaya yaz (sadece dosya adları)
                fs.writeFileSync(path.join(dumpDir, '.latest_import'), newFiles.join('\n'));

                console.log(`Başarılı! ${items.length} araç verisi ${actor.id} ile çekildi.`);
                console.log(`Ham veriler 'dump/' klasörüne kaydedildi.`);
                return; 
            } else {
                console.warn(`${actor.id} ile veri bulunamadı.`);
            }

        } catch (error) {
            console.error(`${actor.id} hatası:`, error.message);
        }
    }

    console.error('\nMaalesef hiçbir Apify Actor\'ü ile veri çekilemedi.');
    process.exit(1);
}

fetchCarData();
