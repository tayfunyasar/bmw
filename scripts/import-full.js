import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Argümanları al, virgül varsa parçala, boşlukları temizle ve boş olanları at
const args = process.argv.slice(2)
    .flatMap(arg => arg.split(','))
    .map(s => s.trim())
    .filter(Boolean);

if (args.length === 0) {
    console.error('Lütfen en az bir mobile.de URL\'si veya İlan ID\'si sağlayın.');
    console.error('Örnek: npm run import:apify "451532354" "451532355"');
    process.exit(1);
}

const finalToImport = [];

for (const arg of args) {
    let mobileDeId = null;

    if (/^\d+$/.test(arg)) {
        mobileDeId = arg;
    } else {
        const match = arg.match(/id=(\d+)/) || arg.match(/\/(\d+)\.html/);
        mobileDeId = match ? match[1] : arg; // ID bulunamazsa url'in kendisini pasla
    }

    if (mobileDeId) {
        finalToImport.push(mobileDeId);
    }
}

try {
    console.log(`--- 1. Adım: Apify ile ${finalToImport.length} araç verisi çekiliyor (veya güncelleniyor) ---`);
    const argsString = finalToImport.map(a => `"${a}"`).join(' ');
    execSync(`node scripts/apify-fetch-car.js ${argsString}`, { stdio: 'inherit' });

    console.log('\n--- 2. Adım: Veri işleniyor (Eşleştirme ve Güncelleme) ---');
    // Sadece bu komutta indirilen ID'leri işle — diğer dosyalara yan etki olmasın
    execSync(`node scripts/parse-car-json.js ${argsString}`, { stdio: 'inherit' });
    execSync('npm run format:data', { stdio: 'inherit' });

    console.log('\n--- İşlem başarıyla tamamlandı! ---');
} catch (error) {
    console.error('\nBir hata oluştu. Lütfen Apify Token\'ınızı .env dosyasında kontrol edin.');
    process.exit(1);
}
