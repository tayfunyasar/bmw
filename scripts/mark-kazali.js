import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const coupeKazaliPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_KAZALI.json');
const granCoupeKazaliPath = path.join(listingsDir, 'GRAN_COUPE_KAZALI.json');

const SOURCE_FILES = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_GAS_WITHOUT_SUNROOF.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'GRAN_COUPE.json',
  'CABRIO.json'
];

// Kaynak dosya isminden hedef kazali dosyasini sec. Body-style suffix'leri yok,
// kaynak dosya zaten dogru kasa tipini biliyor.
function pickKazaliTarget(sourceFile) {
  if (sourceFile === 'GRAN_COUPE.json') {
    return { path: granCoupeKazaliPath, name: 'GRAN_COUPE_KAZALI.json' };
  }
  return { path: coupeKazaliPath, name: 'COUPE_GAS_WITH_SUNROOF_KAZALI.json' };
}

const [arg, ...reasonParts] = process.argv.slice(2);
if (!arg) {
  console.error('Kullanım: npm run kazali -- <mobileDeId | listingId> [neden]');
  process.exit(1);
}
const reason = reasonParts.join(' ').trim() || 'Manuel işaretlendi';

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

const target = pickKazaliTarget(sourceFile);

foundCar.auditHistory = foundCar.auditHistory || [];
foundCar.auditHistory.push({
  action: "Kazalı İşaretlendi",
  detail: `${sourceFile} dosyasından ${target.name} dosyasına taşındı — ${reason}`,
  changes: null,
  auditDate: new Date().toISOString()
});
foundCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));

foundCar.listingDescriptionNotes = foundCar.listingDescriptionNotes || [];
const note = `⚠️ KAZALI olarak işaretlendi — ${reason}`;
if (!foundCar.listingDescriptionNotes.includes(note)) {
  foundCar.listingDescriptionNotes.push(note);
}

const kazali = JSON.parse(fs.readFileSync(target.path, 'utf-8'));
kazali.push(foundCar);
fs.writeFileSync(target.path, JSON.stringify(kazali, null, 2) + '\n', 'utf-8');

console.log(`💥 ${foundCar.listingId} (${foundCar.mobileDeId}) kazalı olarak taşındı — ${sourceFile} → ${target.name} (${reason})`);
