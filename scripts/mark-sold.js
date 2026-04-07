import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const soldPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_SOLD.json');

const SOURCE_FILES = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_GAS_WITHOUT_SUNROOF.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'GRAN_COUPE.json'
];

const mobileDeId = process.argv[2];
if (!mobileDeId) {
  console.error('Kullanım: npm run sell -- <mobileDeId>');
  process.exit(1);
}

let foundCar = null;
let sourceFile = null;

for (const file of SOURCE_FILES) {
  const filePath = path.join(listingsDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const index = data.findIndex(c => c.mobileDeId === mobileDeId);

  if (index !== -1) {
    foundCar = data[index];
    sourceFile = file;
    data.splice(index, 1);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    break;
  }
}

if (!foundCar) {
  console.error(`Hata: mobileDeId ${mobileDeId} aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

foundCar.auditHistory = foundCar.auditHistory || [];
foundCar.auditHistory.push({
  action: "İlan Satıldı",
  detail: `${sourceFile} dosyasından SOLD olarak taşındı`,
  changes: null,
  auditDate: new Date().toISOString()
});
foundCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));

const sold = JSON.parse(fs.readFileSync(soldPath, 'utf-8'));
sold.push(foundCar);
fs.writeFileSync(soldPath, JSON.stringify(sold, null, 2) + '\n', 'utf-8');

console.log(`✅ ${foundCar.listingId} (${mobileDeId}) satıldı — ${sourceFile} → COUPE_GAS_WITH_SUNROOF_SOLD.json`);
