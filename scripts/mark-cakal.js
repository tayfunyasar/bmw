import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const cakalPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_CAKAL.json');

const SOURCE_FILES = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_GAS_WITHOUT_SUNROOF.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'GRAN_COUPE.json'
];

const arg = process.argv[2];
if (!arg) {
  console.error('Kullanım: npm run cakal -- <mobileDeId | listingId>');
  process.exit(1);
}

const matches = (car) => car.mobileDeId === arg || car.listingId === arg;

let foundCar = null;
let sourceFile = null;

for (const file of SOURCE_FILES) {
  const filePath = path.join(listingsDir, file);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const index = data.findIndex(matches);

  if (index !== -1) {
    foundCar = data[index];
    sourceFile = file;
    data.splice(index, 1);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    break;
  }
}

if (!foundCar) {
  console.error(`Hata: "${arg}" aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

foundCar.auditHistory = foundCar.auditHistory || [];
foundCar.auditHistory.push({
  action: "Çakal Kasa İşaretlendi",
  detail: `${sourceFile} dosyasından CAKAL olarak taşındı`,
  changes: null,
  auditDate: new Date().toISOString()
});
foundCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));

const cakal = JSON.parse(fs.readFileSync(cakalPath, 'utf-8'));
cakal.push(foundCar);
fs.writeFileSync(cakalPath, JSON.stringify(cakal, null, 2) + '\n', 'utf-8');

console.log(`🐺 ${foundCar.listingId} (${foundCar.mobileDeId}) çakal kasaya taşındı — ${sourceFile} → COUPE_GAS_WITH_SUNROOF_CAKAL.json`);
