import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const TARGET_FILE = 'COUPE_GAS_WITHOUT_SUNROOF.json';
const targetPath = path.join(listingsDir, TARGET_FILE);

const SOURCE_FILES = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'GRAN_COUPE.json',
  'CABRIO.json',
];

const arg = process.argv[2];
if (!arg) {
  console.error('Kullanım: npm run move:withoutsunroof -- <mobileDeId | listingId>');
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
  console.error(`Hata: "${arg}" sunroof'lu aktif listelerden hiçbirinde bulunamadı.`);
  process.exit(1);
}

const previousS403A = foundCar.equipmentFeatures?.S403A ?? 'unknown';
foundCar.equipmentFeatures = foundCar.equipmentFeatures || {};
foundCar.equipmentFeatures.S403A = 'no';
foundCar.overrideFeatures = foundCar.overrideFeatures || {};
foundCar.overrideFeatures.S403A = {
  value: 'no',
  reason: 'Kullanıcı teyidi: sunroof yok'
};

const sourceName = sourceFile.replace('.json', '');
const targetName = TARGET_FILE.replace('.json', '');
foundCar.auditHistory = foundCar.auditHistory || [];
foundCar.auditHistory.push({
  action: `Dosya Taşıma: ${sourceName} → ${targetName}`,
  detail: 'Kullanıcı teyidi sonucu sunroof olmadığı tespit edildi',
  changes: {
    'equipmentFeatures.S403A': {
      from: previousS403A,
      to: 'no'
    }
  },
  auditDate: new Date().toISOString()
});
foundCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));

const target = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
target.push(foundCar);
fs.writeFileSync(targetPath, JSON.stringify(target, null, 2) + '\n', 'utf-8');

console.log(`🔀 ${foundCar.listingId} (${foundCar.mobileDeId}) sunroof'suz olarak işaretlendi — ${sourceFile} → ${TARGET_FILE}`);
